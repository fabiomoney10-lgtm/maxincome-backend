const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const API_KEY = process.env.BYBIT_API_KEY || '';
const SECRET_KEY = process.env.BYBIT_SECRET_KEY || '';

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint seguro para receber o pedido do seu navegador e assinar para a Bybit
app.post('/place-order-proxy', async (req, res) => {
    try {
        const timestamp = Date.now().toString();
        const recvWindow = '5000';
        
        const bodyData = {
            category: "spot",
            symbol: "XRPUSDT",
            side: "Buy",
            orderType: "Market",
            qty: "6"
        };

        const jsonBody = JSON.stringify(bodyData);
        const signature = crypto
            .createHmac('sha256', SECRET_KEY)
            .update(timestamp + API_KEY + recvWindow + jsonBody)
            .digest('hex');

        const response = await axios.post('https://api.bybit.com/v5/order/create', bodyData, {
            headers: {
                'X-BAPI-API-KEY': API_KEY,
                'X-BAPI-SIGN': signature,
                'X-BAPI-TIMESTAMP': timestamp,
                'X-BAPI-RECV-WINDOW': recvWindow,
                'Content-Type': 'application/json'
            }
        });

        res.json({ success: true, result: response.data });
    } catch (error) {
        res.json({ success: false, error: error.response?.data || error.message });
    }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
