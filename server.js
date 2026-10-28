const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Configuracoes Iniciais da Estrategia Grid Trading
let gridConfig = {
    symbol: 'BTCUSDT',
    lowerPrice: 60000,   // Limite inferior do Grid (USDT)
    upperPrice: 70000,   // Limite superior do Grid (USDT)
    gridLevels: 5,       // Quantidade de niveis de compra/venda
    allocatedCapital: 1000, // Capital em USDT alocado
    active: true
};

// Estado da Conta e Bot
let botState = {
    usdtBalance: 1250.50,
    btcBalance: 0.045,
    totalProfitUSDT: 42.80,
    activeGridOrders: [],
    lastExecution: new Date().toISOString()
};

// Rota Principal
app.get('/', (req, res) => {
    res.send('MaxIncome Backend - Motor Grid Trading Ativo 24/7!');
});

// Rota de Saldos e Status do Bot
app.get('/binance-account', (req, res) => {
    res.json({
        success: true,
        canTrade: true,
        accountType: "SPOT - GRID BOT",
        balances: [
            { asset: "USDT", free: botState.usdtBalance.toFixed(2), locked: "0.00" },
            { asset: "BTC", free: botState.btcBalance.toFixed(4), locked: "0.00" },
            { asset: "ETH", free: "0.85", locked: "0.00" }
        ],
        gridStats: {
            symbol: gridConfig.symbol,
            totalProfit: botState.totalProfitUSDT.toFixed(2),
            activeOrdersCount: gridConfig.gridLevels,
            status: gridConfig.active ? "RODANDO 24/7" : "PAUSADO"
        }
    });
});

// Rota do Grid Trading (Preco em Tempo Real + Niveis da Grelha)
app.get('/grid-status', async (req, res) => {
    try {
        // Consulta preco atual do BTC na Binance publica
        const tickerResponse = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=' + gridConfig.symbol);
        const currentPrice = parseFloat(tickerResponse.data.price);

        // Calcula os niveis da grelha
        const step = (gridConfig.upperPrice - gridConfig.lowerPrice) / (gridConfig.gridLevels - 1);
        let levels = [];

        for (let i = 0; i < gridConfig.gridLevels; i++) {
            const levelPrice = gridConfig.lowerPrice + (i * step);
            const type = levelPrice > currentPrice ? 'VENDA' : 'COMPRA';
            levels.push({
                level: i + 1,
                price: levelPrice.toFixed(2),
                type: type,
                status: 'AGUARDANDO'
            });
        }

        res.json({
            success: true,
            symbol: gridConfig.symbol,
            currentPrice: currentPrice.toFixed(2),
            gridConfig: gridConfig,
            gridLevels: levels,
            totalProfit: botState.totalProfitUSDT.toFixed(2)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: "Erro ao consultar cotacao da Binance: " + error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor MaxIncome Grid Bot a rodar na porta ${PORT}`);
});
