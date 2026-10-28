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
const BYBIT_URL = 'https://api.bybit.com';

let systemLogs = ["[Auto] Servidor ligado. A aguardar primeiro ciclo..."];
let ordemEnviada = false;

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

// Função de execução de ordem real
async function executarOrdemNaBybit() {
    if (!API_KEY || !SECRET_KEY) {
        addLog("❌ ERRO: Chaves API Bybit não configuradas no Render!");
        return;
    }

    try {
        addLog("🔑 Chaves detetadas. A preparar assinatura para a Bybit...");
        const timestamp = Date.now().toString();
        const recvWindow = '5000';
        
        const bodyData = {
            category: "spot",
            symbol: "XRPUSDT",
            side: "Buy",
            orderType: "Market",
            qty: "6" // 6 XRP (~$7.9 USDT)
        };

        const jsonBody = JSON.stringify(bodyData);
        const signature = crypto
            .createHmac('sha256', SECRET_KEY)
            .update(timestamp + API_KEY + recvWindow + jsonBody)
            .digest('hex');

        addLog("🚀 A enviar ordem de 6 XRP para a Bybit Spot...");

        const response = await axios.post(`${BYBIT_URL}/v5/order/create`, bodyData, {
            headers: {
                'X-BAPI-API-KEY': API_KEY,
                'X-BAPI-SIGN': signature,
                'X-BAPI-TIMESTAMP': timestamp,
                'X-BAPI-RECV-WINDOW': recvWindow,
                'Content-Type': 'application/json'
            },
            timeout: 8000
        });

        const resData = response.data;
        if (resData?.retCode === 0) {
            addLog(`✅ ORDEM EXECUTADA COM SUCESSO! ID: ${resData.result.orderId}`);
            ordemEnviada = true;
        } else {
            addLog(`⚠️ Resposta da Bybit [${resData?.retCode}]: ${resData?.retMsg}`);
            if (resData?.retCode === 10004) {
                addLog("💡 Dica: Verifique se a sua API Key na Bybit tem permissão de 'Order' (Spot Trading) ativada.");
            }
        }
    } catch (error) {
        const errDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        addLog(`❌ Falha na conexão com a Bybit: ${errDetails}`);
    }
}

// Inicia o ciclo autónomo imediatamente após o arranque do servidor
setTimeout(async () => {
    addLog("⚙️ A iniciar motor autónomo de verificação...");
    await executarOrdemNaBybit();
}, 3000);

// Consulta de saldo
app.get('/binance-account', async (req, res) => {
    res.json({
        success: true,
        balances: [{ asset: "USDT", free: "9.01" }]
    });
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
