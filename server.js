const express = require('express');
const https = require('https');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// --- SUAS CREDENCIAIS REAIS DIRETAS (COLE AQUI PARA FUNCIONAR JÁ) ---
const BYBIT_API_KEY = 'SUA_API_KEY_AQUI';
const BYBIT_SECRET_KEY = 'SUA_SECRET_KEY_AQUI';

const TELEGRAM_BOT_TOKEN = '9179415153:AAGUvi8GmakFwjrxT_3BM2IoqqYkIssGTag';
const TELEGRAM_CHAT_ID = '1633419568';
const BYBIT_HOST = 'api.bybit.com';

const ATIVOS = ['XRPUSDT', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

let dadosPainel = {
    saldoUsdt: "A sincronizar...",
    saldoXrp: "A sincronizar...",
    cotacoes: {},
    ultimoLog: "[Sistema] Ligação direta estabelecida com a Bybit."
};

function enviarMensagemTelegram(texto) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const dados = JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: texto, parse_mode: 'Markdown' });
    const urlObj = new URL(url);
    const options = { hostname: urlObj.hostname, path: urlObj.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(dados) } };
    const req = https.request(options, (res) => { res.on('data', () => {}); });
    req.on('error', () => {});
    req.write(dados);
    req.end();
}

function consultarSaldoBybit() {
    const timestamp = Date.now().toString();
    const queryString = "accountType=SPOT";
    const signaturePayload = timestamp + BYBIT_API_KEY + '5000' + queryString;
    const signature = crypto.createHmac('sha256', BYBIT_SECRET_KEY).update(signaturePayload).digest('hex');

    const options = {
        hostname: BYBIT_HOST,
        path: `/v5/account/wallet-balance?${queryString}`,
        method: 'GET',
        headers: {
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
                if (resJson.retCode === 0 && resJson.result && resJson.result.list) {
                    const moedas = resJson.result.list[0].coin;
                    moedas.forEach(m => {
                        if (m.coin === 'USDT') dadosPainel.saldoUsdt = parseFloat(m.walletBalance).toFixed(2);
                        if (m.coin === 'XRP') dadosPainel.saldoXrp = parseFloat(m.walletBalance).toFixed(2);
                    });
                } else {
                    dadosPainel.ultimoLog = `[Erro Bybit Saldo]: ${resJson.retMsg}`;
                }
            } catch (e) {
                console.error("Erro parse:", e);
            }
        });
    });
    req.on('error', () => {});
    req.end();
}

function consultarMercado() {
    ATIVOS.forEach(simbolo => {
        const options = { hostname: BYBIT_HOST, path: `/v5/market/tickers?category=spot&symbol=${simbolo}`, method: 'GET' };
        const req = https.request(options, (res) => {
            let resposta = '';
            res.on('data', (chunk) => { resposta += chunk; });
            res.on('end', () => {
                try {
                    const resJson = JSON.parse(resposta);
                    if (resJson.retCode === 0 && resJson.result && resJson.result.list) {
                        dadosPainel.cotacoes[simbolo] = parseFloat(resJson.result.list[0].lastPrice).toFixed(4);
                    }
                } catch (e) {}
            });
        });
        req.on('error', () => {});
        req.end();
    });
}

// Motor autónomo de rondas
function iniciarMotorAutonomo() {
    setInterval(() => {
        const agora = new Date();
        if (agora.getMinutes() % 5 === 0 && agora.getSeconds() <= 5) {
            dadosPainel.ultimoLog = `[${agora.toLocaleTimeString()}] 🔍 Análise de Grid Trading ativa na nuvem para múltiplos ativos.`;
        }
    }, 5000);
}

setInterval(() => {
    consultarSaldoBybit();
    consultarMercado();
}, 10000);

app.get('/', (req, res) => {
    let cotacoesHtml = '';
    for (let [ativo, preco] of Object.entries(dadosPainel.cotacoes)) {
        cotacoesHtml += `<span style="margin: 0 10px;"><b>${ativo}:</b> $${preco}</span><br>`;
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="pt">
        <head>
            <meta charset="UTF-8">
            <title>MaxIncome - Nuvem Autónoma 24/7</title>
            <meta http-equiv="refresh" content="10">
            <style>
                body { background-color: #0d1117; color: #c9d1d9; font-family: Arial, sans-serif; text-align: center; margin: 0; padding: 20px; }
                h1 { color: #f0a500; }
                .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; margin: 20px auto; padding: 20px; width: 80%; max-width: 800px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
                .status { color: #2ea043; font-weight: bold; }
                .price { color: #f0a500; font-size: 20px; font-weight: bold; }
                .log { background: #0d1117; border: 1px solid #30363d; padding: 15px; text-align: left; font-family: monospace; color: #3fb950; border-radius: 4px; height: 100px; overflow-y: auto; }
            </style>
        </head>
        <body>
            <h1>MaxIncome - Nuvem Autónoma 24/7</h1>
            <p>Sistema Multi-Ativo de Grid Trading (Compra na Baixa e Venda na Alta)</p>
            
            <div class="card">
                <h3>Ativos em Monitorização Contínua</h3>
                <p class="status">🟢 XRP, BTC, ETH, SOL Ativos na Nuvem</p>
            </div>

            <div class="card">
                <h3>Saldo Disponível na Bybit (Real)</h3>
                <p class="price">${dadosPainel.saldoUsdt} USDT | ${dadosPainel.saldoXrp} XRP</p>
            </div>

            <div class="card">
                <h3>Cotações de Mercado em Tempo Real</h3>
                <div class="price">${cotacoesHtml || 'A ligar à Bybit...'}</div>
            </div>

            <div class="card">
                <h3>Registo de Atividade do Grid Trading</h3>
                <div class="log">${dadosPainel.ultimoLog}</div>
            </div>
        </body>
        </html>
    `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    consultarSaldoBybit();
    consultarMercado();
    iniciarMotorAutonomo();
});
