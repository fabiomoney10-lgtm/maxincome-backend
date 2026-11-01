const express = require('express');
const https = require('https');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// --- CONFIGURAÇÕES DE ACESSO ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9179415153:AAGUvi8GmakFwjrxT_3BM2IoqqYkIssGTag';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1633419568';

// Insira as suas chaves reais da Bybit aqui ou nas variáveis de ambiente do Render
const BYBIT_API_KEY = process.env.BYBIT_API_KEY || 'SUA_API_KEY_AQUI';
const BYBIT_SECRET_KEY = process.env.BYBIT_SECRET_KEY || 'SUA_SECRET_KEY_AQUI';
const BYBIT_HOST = 'api.bybit.com';
const PAR_ATIVO = 'XRPUSDT';

let dadosPainel = {
    saldoUsdt: "A carregar...",
    saldoXrp: "A carregar...",
    cotacaoAtual: "0.0000",
    ultimoLog: "[Sistema] A ligar à API da Bybit..."
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
        res.on('end', () => {
            console.log("Alerta enviado para o Telegram.");
        });
    });

    req.on('error', (e) => {
        console.error(`Erro ao enviar telegram: ${e.message}`); });  req.write(dados); req.end(); }  // --- FUNÇÃO PARA BUSCAR SALDOS REAIS NA BYBIT --- function consultarSaldoBybit() { const timestamp = Date.now().toString(); const queryString = "accountType=SPOT"; const signaturePayload = timestamp + BYBIT_API_KEY + '5000' + queryString; const signature = crypto.createHmac('sha256', BYBIT_SECRET_KEY).update(signaturePayload).digest('hex');  const options = { hostname: BYBIT_HOST, path: `/v5/account/wallet-balance?${queryString}`,
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
                    let usdt = "0.00";
                    let xrp = "0.00";
                    
                    moedas.forEach(m => {
                        if (m.coin === 'USDT') usdt = parseFloat(m.walletBalance).toFixed(2);
                        if (m.coin === 'XRP') xrp = parseFloat(m.walletBalance).toFixed(2);
                    });

                    dadosPainel.saldoUsdt = usdt;
                    dadosPainel.saldoXrp = xrp;
                }
            } catch (e) {
                console.error("Erro ao interpretar saldo da Bybit:", e);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Erro ao consultar saldo: ${e.message}`); });  req.end(); }  // --- FUNÇÃO PARA BUSCAR COTAÇÃO REAL DA XRP --- function consultarCotacaoBybit() { const options = { hostname: BYBIT_HOST, path: `/v5/market/tickers?category=spot&symbol=${PAR_ATIVO}`,
        method: 'GET'
    };

    const req = https.request(options, (res) => {
        let resposta = '';
        res.on('data', (chunk) => { resposta += chunk; });
        res.on('end', () => {
            try {
                const resJson = JSON.parse(resposta);
                if (resJson.retCode === 0 && resJson.result && resJson.result.list) {
                    dadosPainel.cotacaoAtual = parseFloat(resJson.result.list[0].lastPrice).toFixed(4);
                }
            } catch (e) {
                console.error("Erro ao consultar cotação:", e);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Erro ao consultar cotação: ${e.message}`); });  req.end(); }  // --- EXECUTAR ORDENS REAIS NA BYBIT --- function executarOrdemReal(lado, precoReferencia) { const timestamp = Date.now().toString(); const endpoint = '/v5/order/create';  const bodyObj = { category: "spot", symbol: PAR_ATIVO, side: lado, orderType: "Market", qty: "1.5" }; const bodyString = JSON.stringify(bodyObj);  const signaturePayload = timestamp + BYBIT_API_KEY + '5000' + bodyString; const signature = crypto.createHmac('sha256', BYBIT_SECRET_KEY).update(signaturePayload).digest('hex');  const options = { hostname: BYBIT_HOST, path: endpoint, method: 'POST', headers: { 'Content-Type': 'application/json', 'X-BAPI-API-KEY': BYBIT_API_KEY, 'X-BAPI-TIMESTAMP': timestamp, 'X-BAPI-SIGN': signature, 'X-BAPI-RECV-WINDOW': '5000' } };  const req = https.request(options, (res) => { let resposta = ''; res.on('data', (chunk) => { resposta += chunk; }); res.on('end', () => { try { const resJson = JSON.parse(resposta); const horaStr = new Date().toLocaleTimeString(); if (resJson.retCode === 0) { dadosPainel.ultimoLog = `[${horaStr}] 🟢 Ordem ${lado} executada com sucesso! Preço: $${precoReferencia}`;
                    enviarMensagemTelegram(`🚨 *ORDEM REAL EXECUTADA*\n\n• Ação: ${lado}\n• Par: XRP/USDT\n• Preço: $${precoReferencia}\n• Horário: ${horaStr}`); } else { dadosPainel.ultimoLog = `[${horaStr}] ⚠️ Erro Bybit: ${resJson.retMsg}`;
                }
            } catch (e) {
                console.error("Erro ao processar resposta da ordem:", e);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Erro na requisição de ordem: ${e.message}`);
    });

    req.write(bodyString);
    req.end();
}

// Atualiza dados periodicamente da corretora
setInterval(() => {
    consultarSaldoBybit();
    consultarCotacaoBybit();
}, 10000);

// --- ROTA DA INTERFACE VISUAL ORIGINAL ---
app.get('/', (req, res) => {
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
                .price { color: #f0a500; font-size: 24px; font-weight: bold; }
                .log { background: #0d1117; border: 1px solid #30363d; padding: 15px; text-align: left; font-family: monospace; color: #3fb950; border-radius: 4px; height: 100px; overflow-y: auto; }
            </style>
        </head>
        <body>
            <h1>MaxIncome - Nuvem Autónoma 24/7</h1>
            <p>Sistema de Grid Trading Autónomo (Compra na Baixa e Venda na Alta)</p>
            
            <div class="card">
                <h3>Ativo em Operação: XRP (XRP/USDT)</h3>
