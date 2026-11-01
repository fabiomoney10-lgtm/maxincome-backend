const express = require('express');
const https = require('https');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// --- CONFIGURAÇÕES DE ACESSO ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9179415153:AAGUvi8GmakFwjrxT_3BM2IoqqYkIssGTag';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1633419568';

const BYBIT_API_KEY = process.env.BYBIT_API_KEY || 'SUA_API_KEY_AQUI';
const BYBIT_SECRET_KEY = process.env.BYBIT_SECRET_KEY || 'SUA_SECRET_KEY_AQUI';
const BYBIT_HOST = 'api.bybit.com';
const PAR_ATIVO = 'XRPUSDT';

let estadoAtual = {
    ativo: "XRP (XRP/USDT)",
    statusRobo: "Robô em Ciclo Perpétuo Ativo",
    saldoUsdt: "7.00",
    saldoXrp: "1.57",
    cotacaoAtual: "1.2916",
    ultimoLog: "[11:04:14] 🔍 Tem 1.57 XRP. Alvo de Venda: $1.3220 (Atual: $1.2916)"
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
            console.log("Notificação enviada para o Telegram.");
        });
    });

    req.on('error', (e) => {
        console.error(`Erro ao enviar telegram: ${e.message}`);
    });

    req.write(dados);
    req.end();
}

// --- ROTA DA INTERFACE VISUAL ORIGINAL ---
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt">
        <head>
            <meta charset="UTF-8">
            <title>MaxIncome - Nuvem Autónoma 24/7</title>
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
            <p>Sistema de Grid Trading Autónomo (Roda Gigante: Compra na Baixa e Venda na Alta)</p>
            
            <div class="card">
                <h3>Ativo em Operação: ${estadoAtual.ativo}</h3>
                <p class="status">🟢 ${estadoAtual.statusRobo}</p>
            </div>

            <div class="card">
                <h3>Saldo Disponível (Bybit)</h3>
                <p class="price">${estadoAtual.saldoUsdt} USDT | ${estadoAtual.saldoXrp} XRP</p>
            </div>

            <div class="card">
                <h3>Cotação de Mercado em Tempo Real (XRPUSDT)</h3>
                <p class="price">$ ${estadoAtual.cotacaoAtual}</p>
            </div>

            <div class="card">
                <h3>Registo de Atividade do Grid Trading</h3>
                <div class="log">${estadoAtual.ultimoLog}</div>
            </div>
        </body>
        </html>
    `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor visual e motor a rodar na porta ${PORT}`);
});
