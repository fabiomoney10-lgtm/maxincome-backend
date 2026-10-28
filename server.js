const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Estado do Bot com múltiplas moedas suportadas
let botState = {
    usdtBalance: 1250.50,
    totalProfitUSDT: 42.80,
    tradesCount: 12,
    tradesHistory: [
        { id: 102, symbol: 'BTCUSDT', type: 'VENDA COM LUCRO', amount: '+$ 1.20', time: 'Há 5 mins' },
        { id: 101, symbol: 'ETHUSDT', type: 'COMPRA GRID', amount: '+$ 0.85', time: 'Há 18 mins' },
        { id: 100, symbol: 'BTCUSDT', type: 'VENDA COM LUCRO', amount: '+$ 1.50', time: 'Há 32 mins' }
    ]
};

// Motor Autónomo Multi-Moeda
async function runGridBotEngine(symbol) {
    try {
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        const currentPrice = parseFloat(response.data.price);
        
        // Simula dinamicamente novas operações lucrativas
        if (Math.random() > 0.6) {
            const profit = parseFloat((Math.random() * 1.5).toFixed(2));
            botState.totalProfitUSDT += profit;
            botState.usdtBalance += profit;
            botState.tradesCount += 1;
            
            // Adiciona ao histórico recente
            botState.tradesHistory.unshift({
                id: botState.tradesCount,
                symbol: symbol,
                type: Math.random() > 0.5 ? 'VENDA COM LUCRO' : 'COMPRA GRID',
                amount: `+$ ${profit.toFixed(2)}`,
                time: 'Agora mesmo'
            });
            
            if (botState.tradesHistory.length > 5) botState.tradesHistory.pop();
        }
        return currentPrice;
    } catch (err) {
        return 67450.00;
    }
}

app.get('/', (req, res) => {
    res.send('MaxIncome Backend - Multi-Grid Bot Ativo na Nuvem!');
});

app.get('/binance-account', async (req, res) => {
    res.json({
        success: true,
        canTrade: true,
        accountType: "MULTI-GRID BOT (PAPER TRADING)",
        balances: [
            { asset: "USDT", free: botState.usdtBalance.toFixed(2), locked: "0.00" },
            { asset: "BTC", free: "0.0450", locked: "0.00" },
            { asset: "ETH", free: "0.8500", locked: "0.00" }
        ],
        gridStats: {
            totalProfit: botState.totalProfitUSDT.toFixed(2),
            tradesExecuted: botState.tradesCount,
            tradesHistory: botState.tradesHistory,
            roiDaily: "+3.42%",
            status: "RODANDO 24/7 (MULTIMOEDA)"
        }
    });
});

app.get('/grid-status', async (req, res) => {
    const symbol = req.query.symbol || 'BTCUSDT';
    try {
        const currentPrice = await runGridBotEngine(symbol);
        
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
                status: Math.abs(levelPrice - currentPrice) < (upper * 0.05) ? 'EXECUTADO / LUCRO' : 'AGUARDANDO'
            });
        }

        res.json({
            success: true,
            symbol: symbol,
            currentPrice: currentPrice.toFixed(2),
            gridLevels: levels,
            totalProfit: botState.totalProfitUSDT.toFixed(2),
            tradesHistory: botState.tradesHistory
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => console.log(`Servidor a rodar na porta ${PORT}`));
