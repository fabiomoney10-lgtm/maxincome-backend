const express = require('express');
const https = require('https');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// --- CONFIGURAÇÕES DE ACESSO ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9179415153:AAGUvi8GmakFwjrxT_3BM2IoqqYkIssGTag';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1633419568';

// Insira as suas chaves reais da Bybit diretamente aqui ou configure no Render
const BYBIT_API_KEY = process.env.BYBIT_API_KEY || 'SUA_API_KEY_AQUI';
const BYBIT_SECRET_KEY = process.env.BYBIT_SECRET_KEY || 'SUA_SECRET_KEY_AQUI';
const BYBIT_HOST = 'api.bybit.com';
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
            console.log("Notificação enviada para o Telegram com sucesso.");
        });
    });

    req.on('error', (e) => {
        console.error(`Erro ao enviar mensagem para o Telegram: ${e.message}`);
    });

    req.write(dados);
    req.end();
}

// --- FUNÇÃO DE EXECUÇÃO DE ORDEM REAL NA BYBIT (SPOT) ---
function executarOrdemReal(lado, precoReferencia) {
    const timestamp = Date.now().toString();
    const endpoint = '/v5/order/create';
    
    const bodyObj = {
        category: "spot",
        symbol: PAR_ATIVO,
        side: lado, // "Buy" (Comprar na baixa) ou "Sell" (Vender na alta)
        orderType: "Market",
        qty: "5.0" // Quantidade de XRP por ordem (ajustável conforme o seu saldo)
    };
    const bodyString = JSON.stringify(bodyObj);
    
    // Assinatura de segurança HMAC exigida pela Bybit V5
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
                    console.log(`[SUCESSO] Ordem real executada na Bybit:`, resJson.result);
                    
                    // DISPARA O ALERTA PARA O TELEGRAM ESTRITAMENTE APÓS A EXECUÇÃO
                    const mensagem = `🟢 *ORDEM REAL EXECUTADA*\n\n` +
                                     `• *Ação:* ${lado.toUpperCase()}\n` +
                                     `• *Par:* XRP/USDT\n` +
                                     `• *Preço:* ${precoReferencia}\n` +
                                     `• *Horário:* ${new Date().toLocaleTimeString()}`;
                    enviarMensagemTelegram(mensagem);
                } else {
                    console.error(`Erro retornado pela Bybit:`, resJson.retMsg);
                    enviarMensagemTelegram(`⚠️ *Erro na Ordem Real Bybit:* ${resJson.retMsg}`);
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

// --- ROTA DE WEBHOOK / GESTÃO DE ENTRADAS ---
app.post('/webhook', (req, res) => {
    const dados = req.body;
    console.log("Sinal recebido via webhook:", dados);

    // Se receber comando para executar ou avaliar o sinal de compra/venda
    const acao = dados.acao || 'Buy';
    const preco = dados.preco || 'Mercado';

    executarOrdemReal(acao, preco);

    res.status(200).json({ status: "sucesso", mensagem: "Ordem processada pelo servidor!" });
});

app.get('/', (req, res) => {
    res.send('MaxIncome Engine de Ordens Reais a operar 24/7!');
});

// Proteções globais contra quedas do servidor
process.on('uncaughtException', (err) => {
    console.error('Erro não capturado:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Rejeição não tratada:', reason);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de execução a rodar na porta ${PORT}`);
    console.log("Sistema autónomo pronto e à escuta de ordens reais.");
});
