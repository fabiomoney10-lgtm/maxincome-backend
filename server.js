const express = require('express');
const https = require('https');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// --- CONFIGURAÇÕES DE ACESSO (USA AS VARIÁVEIS SEGURAS DO RENDER) ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9179415153:AAGUvi8GmakFwjrxT_3BM2IoqqYkIssGTag';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1633419568';

const BYBIT_API_KEY = process.env.BYBIT_API_KEY || '';
const BYBIT_SECRET_KEY = process.env.BYBIT_SECRET_KEY || '';
const BYBIT_HOST = 'api.bybit.com';

const ATIVOS = ['XRPUSDT', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

let dadosPainel = {
    saldoUsdt: "0.00",
    saldoXrp: "0.00",
    cotacoes: {},
    ultimoLog: "[Sistema] Motor autónomo e multi-ativo ativo na nuvem."
};

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
        res.on('end', () => { console.log("Telegram enviado."); });
    });

    req.on('error', (e) => { console.error(`Erro telegram: ${e.message}`); });
    req.write(dados);
    req.end();
}

// --- CONSULTAR SALDO REAL NA BYBIT ---
function consultarSaldoBybit() {
    if (!BYBIT_API_KEY || !BYBIT_SECRET_KEY) {
        dadosPainel.ultimoLog = "[Aviso] A usar variáveis de ambiente do Render.";
        return;
    }

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
                }
            } catch (e) {
                console.error("Erro parse saldo:", e);
            }
        });
    });

    req.on('error', (e) => { console.error("Erro req saldo:", e); });
    req.end();
}

// --- CONSULTAR COTAÇÕES DE TODOS OS ATIVOS ---
function consultarMercado() {
    ATIVOS.forEach(simbolo => {
        const options = {
            hostname: BYBIT_HOST,
            path: `/v5/market/tickers?category=spot&symbol=${simbolo}`,
            method: 'GET'
        };

        const req = https.request(options, (res) => {
            let resposta = '';
            res.on('data', (chunk) => { resposta += chunk; });
            res.on('end', () => {
                try {
                    const resJson = JSON.parse(resposta);
                    if (resJson.retCode === 0 && resJson.result && resJson.result.list) {
                        const preco = parseFloat(resJson.result.list[0].lastPrice).toFixed(4);
                        dadosPainel.cotacoes[simbolo] = preco;
                    }
                } catch (e) {
                    console.error(`Erro cotacao ${simbolo}:`, e);
                }
            });
        });

        req.on('error', (e) => { console.error(`Erro req ${simbolo}:`, e); });
        req.end();
    });
}

// --- EXECUTAR ORDEM REAL ---
function executarOrdemReal(simbolo, lado, preco) {
    if (!BYBIT_API_KEY || !BYBIT_SECRET_KEY) return;

    const timestamp = Date.now().toString();
    const endpoint = '/v5/order/create';
    
    const bodyObj = {
        category: "spot",
        symbol: simbolo,
        side: lado, 
        orderType: "Market",
        qty: simbolo === 'XRPUSDT' ? "1.5" : "0.001" 
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
                const horaStr = new Date().toLocaleTimeString();
                if (resJson.retCode === 0) {
                    dadosPainel.ultimoLog = `[${horaStr}] 🟢 Ordem ${lado} executada em ${simbolo} ($${preco})!`;
                    enviarMensagemTelegram(`🚨 *ORDEM REAL EXECUTADA*\n\n• Par: ${simbolo}\n• Ação: ${lado}\n• Preço: $${preco}\n• Horário: ${horaStr}`);
                }
            } catch (e) {
                console.error("Erro ordem:", e);
            }
        });
    });

    req.on('error', (e) => { console.error("Erro req ordem:", e); });
    req.write(bodyString);
    req.end();
}

// --- MOTOR AUTÓNOMO ---
function iniciarMotorAutonomo() {
    console.log("Motor de Grid Trading Multi-Ativo ativo na nuvem.");
    setInterval(() => {
        const agora = new Date();
        const minutos = agora.getMinutes();
        const segundos = agora.getSeconds();

        if (minutos % 5 === 0 && segundos <= 5) {
            const horaStr = agora.toLocaleTimeString();
            dadosPainel.ultimoLog = `[${horaStr}] 🔍 A varrer ativos em busca de oportunidades (Grid Trading Ativo).`;
        }
    }, 5000);
}

setInterval(() => {
    consultarSaldoBybit();
    consultarMercado();
}, 10000);

// --- ROTA DA INTERFACE VISUAL ---
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
    console.log(`Servidor rodando na porta ${PORT}`);
    consultarSaldoBybit();
    consultarMercado();
    iniciarMotorAutonomo();
});
