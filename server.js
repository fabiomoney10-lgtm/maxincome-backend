const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('MaxIncome Backend a funcionar na nuvem 24/7!');
});

app.get('/binance-account', (req, res) => {
    res.json({
        success: true,
        canTrade: true,
        accountType: "SPOT",
        balances: [
            { asset: "USDT", free: "1,250.50", locked: "0.00" },
            { asset: "BTC", free: "0.045", locked: "0.00" },
            { asset: "ETH", free: "0.85", locked: "0.00" }
        ]
    });
});

app.listen(PORT, () => {
    console.log(`Servidor MaxIncome Backend rodando na porta ${PORT}`);
});
