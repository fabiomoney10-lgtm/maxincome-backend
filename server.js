const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Credenciais da Bybit puxadas das Variáveis de Ambiente do Render
const API_KEY = process.env.BYBIT_API_KEY || '';
const SECRET_KEY = process.env.BYBIT_SECRET_KEY || '';
const BYBIT_URL = 'https://api.bybit.com';

// Função auxiliar para assinar os pedidos da Bybit (V5 API)
function generateSignature(timestamp, recvWindow, queryString) {
    return crypto
        .createHmac('sha256', SECRET_KEY)
        .update(timestamp + API_KEY + recvWindow + queryString)
        .digest('hex');
}

app.get('/', (req, res) => {
    res.send('MaxIncome Backend - Conectado à API Oficial da Bybit!');
});

// Endpoint para ler Saldos Reais da Carteira Spot na Bybit
app.get('/binance-account', async (req, res) => {
    if (!API_KEY || !SECRET_KEY) {
        return res.json({
            success: false,
            message: "Chaves de API da Bybit não configuradas no Render!"
        });
    }

    try {
        const timestamp = Date.now().toString();
        const recvWindow = '5000';
        const queryString = 'accountType=SPOT';
        const signature = generateSignature(timestamp, recvWindow, queryString);

        const response = await axios.get(`${BYBIT_URL}/v5/account/wallet-balance?${queryString}`, {
            headers: {
                'X-BAPI-API-KEY': API_KEY,
                'X-BAPI-SIGN': signature,
                'X-BAPI-TIMESTAMP': timestamp,
                'X-BAPI-RECV-WINDOW': recvWindow
            }
        });

        const walletData = response.data.result?.list?.[0]?.coin || [];
        
        const balances = walletData.map(c => ({
            asset: c.coin,
            free: parseFloat(c.walletBalance || 0).toFixed(2),
            locked: "0.00"
        }));

        res.json({
            success: true,
            canTrade: true,
            accountType: "BYBIT SPOT TRADING REAL",
            balances: balances.length > 0 ? balances : [{ asset: "USDT", free: "0.00", locked: "0.00" }],
            gridStats: {
                totalProfit: "0.00",
                tradesExecuted: 0,
                tradesHistory: [],
                roiDaily: "+0.00%",
                status: "CONECTADO À BYBIT 24/7"
            }
        });

    } catch (error) {
        console.error("Erro na API da Bybit:", error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data?.retMsg || error.message
        });
    }
});

// Endpoint para ler a Cotação Real de Mercado da Bybit
app.get('/grid-status', async (req, res) => {
    const symbol = req.query.symbol || 'BTCUSDT';
    try {
        const tickerRes = await axios.get(`${BYBIT_URL}/v5/market/tickers?category=spot&symbol=${symbol}`);
        const currentPrice = parseFloat(tickerRes.data.result.list[0].lastPrice);

        let lower = symbol === 'ETHUSDT' ? 2400 : (symbol === 'SOLUSDT' ? 120 : 60000);
        let upper = symbol === 'ETHUSDT' ? 3200 : (symbol === 'SOLUSDT' ? 180 : 70000);

        const step = (upper - lower) / 4;
        let levels = [];

        for (let i = 0; i < 5; i++) {
            const levelPrice = lower + (i * step);
            levels.push({
                level: i + 1,
                price: levelPrice.toFixed(2),
                type: levelPrice > currentPrice ? 'VENDA' : 'COMPRA',
                status: 'AGUARDANDO MERCADO'
            });
        }

        res.json({
            success: true,
            symbol: symbol,
            currentPrice: currentPrice.toFixed(2),
            gridLevels: levels,
            totalProfit: "0.00",
            tradesHistory: []
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => console.log(`Servidor a rodar na porta ${PORT}`));
