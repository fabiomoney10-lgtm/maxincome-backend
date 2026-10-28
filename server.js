const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.BINANCE_API_KEY;
const SECRET_KEY = process.env.BINANCE_SECRET_KEY;
const BASE_URL = 'https://api.binance.com';

app.use(express.json());

app.get('/', (req, res) => {
    res.send('MaxIncome Backend a funcionar na nuvem 24/7!');
});

app.get('/binance-account', async (req, res) => {
    try {
        if (!API_KEY || !SECRET_KEY) {
            return res.status(400).json({ error: 'Chaves da Binance não configuradas no servidor.' });
        }

        const timestamp = Date.now();
        const queryString = `timestamp=${timestamp}`;
        
        const signature = crypto
            .createHmac('sha256', SECRET_KEY)
            .update(queryString)
            .digest('hex');

        const response = await axios.get(`${BASE_URL}/api/v3/account?${queryString}&signature=${signature}`, {
            headers: {
                'X-MBX-APIKEY': API_KEY
            }
        });

        res.json({
            success: true,
            canTrade: response.data.canTrade,
            accountType: response.data.accountType,
            balances: response.data.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
        });

    } catch (error) {
        console.error('Erro na API da Binance:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            error: error.response?.data || error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor MaxIncome Backend rodando na porta ${PORT}`);
});
