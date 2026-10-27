// server.js - Servidor de Integração Binance / MaxIncome Pro
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Substitua pelas suas chaves reais da Binance obtidas na API Management
const BINANCE_API_KEY = 'SUA_API_KEY_AQUI';
const BINANCE_SECRET_KEY = 'SUA_SECRET_KEY_AQUI';
const BASE_URL = 'https://api.binance.com';

function generateSignature(queryString) {
    return crypto
        .createHmac('sha256', BINANCE_SECRET_KEY)
        .update(queryString)
        .digest('hex');
}

app.get('/api/binance/account', async (req, res) => {
    try {
        const timestamp = Date.now();
        const queryString = `timestamp=${timestamp}`;
        const signature = generateSignature(queryString);

        const response = await axios.get(`${BASE_URL}/api/v3/account?${queryString}&signature=${signature}`, {
            headers: { 'X-MBXAPIKEY': BINANCE_API_KEY }
        });

        const balances = response.data.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
        
        res.json({ success: true, balances });
    } catch (error) {
        console.error('Erro na chamada da Binance:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: 'Falha ao consultar a API da Binance.' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor MaxIncome Backend rodando em http://localhost:${PORT}`);
});