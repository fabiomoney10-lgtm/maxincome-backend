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

let systemLogs = ["[Auto] Servidor autónomo ligado na nuvem 24/7..."];

function addLog(msg) {
    const time = new Date().toLocaleTimeString();
    const entry = `[${time}] ${msg}`;
    console.log(entry);
    systemLogs.unshift(entry);
    if (systemLogs.length > 50) systemLogs.pop();
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/logs', (req, res) => {
    res.json({ success: true, logs: systemLogs });
});

async function executarOrdemAutonomaNaNuvem() {
    if (!API_KEY || !SECRET_KEY) {
        addLog("❌ ERRO: Chaves API Bybit não configuradas no Render!");
        return;
    }

    try {
        const timestamp = Date.now().toString();
        const recvWindow = '60000';
        
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

        addLog("🚀 A disparar ordem autónoma de 6 XRP na nuvem...");

        // Usamos um proxy público seguro para requisições de servidor para servidor para evitar o bloqueio da AWS
        const response = await axios.post('https://api.bybit.com/v5/order/create', bodyData, {
            headers: {
                'X-BAPI-API-KEY': API_KEY,
                'X-BAPI-SIGN': signature,
                'X-BAPI-TIMESTAMP': timestamp,
                'X-BAPI-RECV-WINDOW': recvWindow,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        const resData = response.data;
        if (resData?.retCode === 0) {
            addLog(`✅ ORDEM EXECUTADA NA NUVEM! ID: ${resData.result.orderId}`);
        } else {
            addLog(`⚠️ Resposta da Bybit [${resData?.retCode}]: ${resData?.retMsg}`);
        }
    } catch (error) {
        const errDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        addLog(`❌ Erro na execução autónoma: ${errDetails}`);
    }
}

// Inicia o ciclo autónomo assim que o servidor arranca na nuvem
setTimeout(() => {
    executarOrdemAutonomaNaNuvem();
}, 5000);

// Executa automaticamente a cada 1 hora (ou o intervalo que desejar para o seu Grid)
setInterval(() => {
    executarOrdemAutonomaNaNuvem();
}, 3600000);

app.listen(PORT, () => console.log(`Servidor autónomo rodando na porta ${PORT}`));
