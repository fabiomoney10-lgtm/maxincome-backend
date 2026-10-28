const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Configuração do Grid Bot Autónomo (Simulação Realista)
let gridConfig = {
    symbol: 'BTCUSDT',
    lowerPrice: 60000,
    upperPrice: 70000,
    gridLevels: 5
};

// Estado Dinâmico do Bot na Nuvem
let botState = {
    usdtBalance: 1250.50,
    btcBalance: 0.045,
    totalProfitUSDT: 42.80,
    tradesCount: 12,
    status: "RODANDO 24/7 (SIMULAÇÃO INTELIGENTE)"
};

// Função autónoma simulada que roda a cada alteração de preço
async function runGridBotEngine() {
    try {
        const response = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=' + gridConfig.symbol);
        const currentPrice = parseFloat(response.data.price);
        
        // Pequena simulação dinâmica de lucro baseada na volatilidade do mercado real
        if (Math.random() > 0.7) {
            const simulatedProfit = 0.50; // Cada acerto gera pequeno lucro em USDT
            botState.totalProfitUSDT += simulatedProfit;
            botState.usdtBalance += simulatedProfit;
            botState.tradesCount += 1;
        }
        return currentPrice;
    } catch (err) {
        console.error("Erro no motor do bot:", err.message);
        return 67450.00;
    }
}

app.get('/', (req, res) => {
    res.send('MaxIncome Backend - Motor Autónomo Ativo na Nuvem!');
});

// Rota de Conta e Saldos Atualizados pelo Bot
app.get('/binance-account', async (req, res) => {
    await runGridBotEngine();
    res.json({
        success: true,
        canTrade: true,
        accountType: "SPOT - GRID BOT (PAPER TRADING)",
        balances: [
            { asset: "USDT", free: botState.usdtBalance.toFixed(2), locked: "0.00" },
            { asset: "BTC", free: botState.btcBalance.toFixed(4), locked: "0.00" },
            { asset: "ETH", free: "0.85", locked: "0.00" }
        ],
        gridStats: {
            symbol: gridConfig.symbol,
            totalProfit: botState.totalProfitUSDT.toFixed(2),
            activeOrdersCount: gridConfig.gridLevels,
            tradesExecuted: botState.tradesCount,
            status: botState.status
        }
    });
});

// Rota de Status e Níveis do Grid com Preço Real da Binance
app.get('/grid-status', async (req, res) => {
    try {
        const tickerResponse = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=' + gridConfig.symbol);
        const currentPrice = parseFloat(tickerResponse.data.price);

        const step = (gridConfig.upperPrice - gridConfig.lowerPrice) / (gridConfig.gridLevels - 1);
        let levels = [];

        for (let i = 0; i < gridConfig.gridLevels; i++) {
            const levelPrice = gridConfig.lowerPrice + (i * step);
            const type = levelPrice > currentPrice ? 'VENDA' : 'COMPRA';
            // Simula estados dinâmicos das ordens
            const orderStatus = Math.abs(levelPrice - currentPrice) < 2500 ? 'EXECUTADO / LUCRO' : 'AGUARDANDO';

            levels.push({
                level: i + 1,
                price: levelPrice.toFixed(2),
                type: type,
                status: orderStatus
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
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
