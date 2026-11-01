const express = require('express');
const https = require('https');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// --- CONFIGURAÇÕES DA CORRETORA (BYBIT) E TELEGRAM ---
const BYBIT_API_KEY = 'SUA_API_KEY_AQUI';
const BYBIT_SECRET_KEY = 'SUA_SECRET_KEY_AQUI';
const BYBIT_HOST = 'api.bybit.com';

const TELEGRAM_BOT_TOKEN = '9179415153:AAGUvi8GmakFwjrxT_3BM2IoqqYkIssGTag';
const TELEGRAM_CHAT_ID = '1633419568';

const PAR_ATIVO = 'XRPUSDT';

function enviarMensagemTelegram(texto) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const dados = JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: texto,
        parse_mode: 'Markdown'
    });

    const urlObj = new URL(url);
    const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(dados)
        }
    };

    const req = https.request(options, (res) => {
        let resposta = '';
        res.on('data', (chunk) => { resposta += chunk; });
        res.on('end', () => {
            console.log("Alerta de teste enviado para o Telegram.");
        });
    });

    req.on('error', (e) => {
        console.error(`Erro ao enviar telegram: ${e.message}`);
    });

    req.write(dados);
    req.end();
}

// Função para executar ordem real na Bybit
function executarOrdemReal(lado, precoAtual) {
    const timestamp = Date.now().toString();
    const endpoint = '/v5/order/create';
    
    const bodyObj = {
        category: "spot",
        symbol: PAR_ATIVO,
        side: lado, 
        orderType: "Market",
        qty: "5.0" 
    };
    const bodyString = JSON.stringify(bodyObj);
    
    const signaturePayload = timestamp + BYBIT_API_KEY + '5000' + bodyString;
    const signature = crypto.createHmac('sha256', BYBIT_SECRET_KEY).update(signaturePayload).digest('hex');

    const options = {
        hostname: BYBIT_HOST,
        path: endpoint,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-BAPI-API-KEY': BYBIT_API_KEY,
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-SIGN': signature,
            'X-BAPI-RECV-WINDOW': '5000'
        }
    };

    const req = https.request(options, (res) => {
        let resposta = '';
        res.on('data', (chunk) => { resposta += chunk; });
        res.on('end', () => {
            try {
                const resJson = JSON.parse(resposta);
                if (resJson.retCode === 0) {
                    console.log(`[SUCESSO] Ordem real de teste executada na Bybit:`, resJson.result);
                    
                    const mensagem = `🚨 *TESTE DE ORDEM REAL EXECUTADA*\n\n` +
                                     `• *Ação:* ${lado.toUpperCase()}\n` +
                                     `• *Par:* XRP/USDT\n` +
                                     `• *Preço:* ${precoAtual}\n` +
                                     `• *Horário:* ${new Date().toLocaleTimeString()}`;
                    enviarMensagemTelegram(mensagem);
                } else {
                    console.error(`Erro retornado pela Bybit no teste:`, resJson.retMsg);
                    enviarMensagemTelegram(`⚠️ *Erro na Ordem Real de Teste:* ${resJson.retMsg}`);
                }
            } catch (e) {
                console.error("Erro ao interpretar resposta da Bybit:", e);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Erro na requisição à Bybit: ${e.message}`);
    });

    req.write(bodyString);
    req.end();
}

app.get('/', (req, res) => {
    res.send('MaxIncome Engine de Teste de Ordens Reais a operar!');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor a rodar na porta ${PORT}`);
    
    // TESTE IMEDIATO AO ARRANCAR O SERVIDOR (Executa assim que o Render fizer deploy)
    console.log("A disparar teste de ordem real imediata...");
    executarOrdemReal("Buy", "Mercado (Teste)");
});
