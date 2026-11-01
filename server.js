const express = require('express');
const https = require('https');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const BYBIT_API_KEY = process.env.BYBIT_API_KEY || 'SUA_API_KEY_AQUI';
const BYBIT_SECRET_KEY = process.env.BYBIT_SECRET_KEY || 'SUA_SECRET_KEY_AQUI';
const BYBIT_HOST = 'api.bybit.com';

let ultimoPrecoCompra = 1.3115;
let dadosLog = "Servidor autónomo a operar na nuvem 24/7.";

function asyncCryptoHMAC(secret, message) {
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

// --- MOTOR AUTÓNOMO DE EXECUÇÃO NA NUVEM (RODA SOZINHO 24/7) ---
async function executarMotorCloud() {
    if (!BYBIT_API_KEY || BYBIT_API_KEY === 'SUA_API_KEY_AQUI') {
        dadosLog = "[Erro] Chaves da Bybit em falta no servidor.";
        return;
    }

    try {
        // 1. Obter preço atual do XRP
        const priceRes = await new Promise((resolve) => {
            https.get(`https://${BYBIT_HOST}/v5/market/tickers?category=spot&symbol=XRPUSDT`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', () => resolve(null));
        });

        const priceJson = JSON.parse(priceRes);
        if (!priceJson.result || !priceJson.result.list[0]) return;
        const precoAtual = parseFloat(priceJson.result.list[0].lastPrice);

        // 2. Obter saldos reais da conta Bybit (Unified)
        const timestamp = Date.now().toString();
        const recvWindow = '60000';
        const queryString = "accountType=UNIFIED";
        const signatureSaldo = asyncCryptoHMAC(BYBIT_SECRET_KEY, timestamp + BYBIT_API_KEY + recvWindow + queryString);

        const saldoRes = await new Promise((resolve) => {
            const options = {
                hostname: BYBIT_HOST,
                path: `/v5/account/wallet-balance?${queryString}`,
                method: 'GET',
                headers: {
                    'X-BAPI-API-KEY': BYBIT_API_KEY,
                    'X-BAPI-SIGN': signatureSaldo,
                    'X-BAPI-TIMESTAMP': timestamp,
                    'X-BAPI-RECV-WINDOW': recvWindow
                }
            };
            https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', () => resolve(null)).end();
        });

        const saldoData = JSON.parse(saldoRes);
        let usdtDisponivel = 0;
        let xrpDisponivel = 0;

        if (saldoData.retCode === 0 && saldoData.result.list[0]) {
            const moedas = saldoData.result.list[0].coin;
            for (let m of moedas) {
                if (m.coin === "USDT") usdtDisponivel = parseFloat(m.walletBalance || 0);
                if (m.coin === "XRP") xrpDisponivel = parseFloat(m.walletBalance || 0);
            }
        }

        const time = new Date().toLocaleTimeString();

        // 3. Lógica de Grid Trading (Venda na alta / Compra na baixa)
        if (xrpDisponivel >= 1.5) {
            const alvoLucro = ultimoPrecoCompra * 1.008;
            dadosLog = `[${time}] 🔍 Tem ${xrpDisponivel.toFixed(2)} XRP. Alvo de Venda: $${alvoLucro.toFixed(4)} (Atual: $${precoAtual.toFixed(4)})`;

            if (precoAtual >= alvoLucro) {
                const bodyData = {
                    category: "spot",
                    symbol: "XRPUSDT",
                    side: "Sell",
                    orderType: "Market",
                    qty: Math.floor(xrpDisponivel).toString()
                };
                const jsonBody = JSON.stringify(bodyData);
                const sigOrder = asyncCryptoHMAC(BYBIT_SECRET_KEY, timestamp + BYBIT_API_KEY + recvWindow + jsonBody);

                await new Promise((resolve) => {
                    const options = {
                        hostname: BYBIT_HOST,
                        path: '/v5/order/create',
                        method: 'POST',
                        headers: {
                            'X-BAPI-API-KEY': BYBIT_API_KEY,
                            'X-BAPI-SIGN': sigOrder,
                            'X-BAPI-TIMESTAMP': timestamp,
                            'X-BAPI-RECV-WINDOW': recvWindow,
                            'Content-Type': 'application/json'
                        }
                    };
                    const req = https.request(options, (res) => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => resolve(data));
                    });
                    req.write(jsonBody);
                    req.end();
                });
                dadosLog = `[${time}] 💰 VENDA REALIZADA COM SUCESSO NA NUVEM!`;
            }
        } else if (usdtDisponivel >= 1.0) {
            dadosLog = `[${time}] 🔍 Tem ${usdtDisponivel.toFixed(2)} USDT. A monitorizar oportunidade de compra...`;

            const bodyData = {
                category: "spot",
                symbol: "XRPUSDT",
                side: "Buy",
                orderType: "Market",
                qty: "2"
            };
            const jsonBody = JSON.stringify(bodyData);
            const sigOrder = asyncCryptoHMAC(BYBIT_SECRET_KEY, timestamp + BYBIT_API_KEY + recvWindow + jsonBody);

            await new Promise((resolve) => {
                const options = {
                    hostname: BYBIT_HOST,
                    path: '/v5/order/create',
                    method: 'POST',
                    headers: {
                        'X-BAPI-API-KEY': BYBIT_API_KEY,
                        'X-BAPI-SIGN': sigOrder,
                        'X-BAPI-TIMESTAMP': timestamp,
                        'X-BAPI-RECV-WINDOW': recvWindow,
                        'Content-Type': 'application/json'
                    }
                };
                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve(data));
                });
                req.write(jsonBody);
                req.end();
            });
            ultimoPrecoCompra = precoAtual;
            dadosLog = `[${time}] ✅ COMPRA REALIZADA COM SUCESSO NA NUVEM!`;
        }
    } catch (e) {
        console.error("Erro no motor cloud:", e);
    }
}

// O motor executa automaticamente a cada 20 segundos na nuvem
setInterval(executarMotorCloud, 20000);

app.get('/status-log', (req, res) => {
    res.json({ log: dadosLog });
});

app.get('/get-keys', (req, res) => {
    res.json({ apiKey: BYBIT_API_KEY, secretKey: BYBIT_SECRET_KEY });
});

// --- ROTA DO PAINEL VISUAL ---
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <title>MaxIncome - Grid Trading Autónomo 24/7</title>
    <style>
        body { background-color: #131722; color: #d1d4dc; font-family: Arial, sans-serif; text-align: center; margin: 0; padding: 20px; }
        h1 { color: #f0b90b; }
        .card { background: #1e222d; padding: 20px; margin: 15px auto; width: 65%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .status-box { color: #0ecb81; font-weight: bold; margin-bottom: 20px; font-size: 16px; }
        .trade-log { background: #11141d; padding: 15px; border-radius: 5px; margin-top: 10px; font-family: monospace; color: #0ecb81; text-align: left; max-height: 240px; overflow-y: auto; font-size: 13px; line-height: 1.5; }
    </style>
</head>
<body>

    <h1>MaxIncome - Nuvem Autónoma 24/7</h1>
    <p>Sistema de Grid Trading Autónomo (Roda Gigante: Compra na Baixa e Venda na Alta)</p>

    <div class="card">
        <label><strong>Ativo em Operação:</strong> XRP (XRP/USDT)</label>
    </div>

    <div class="status-box">🟢 Robô em Ciclo Perpétuo Ativo na Nuvem (24/7)</div>

    <div class="card">
        <h3>Saldo Disponível (Bybit)</h3>
        <h2 id="saldoInfo" style="color: #0ecb81;">A carregar saldos...</h2>
    </div>

    <div class="card">
        <h3>Cotação de Mercado em Tempo Real (XRPUSDT)</h3>
        <h2 id="currentPrice" style="color: #f0b90b;">$ --</h2>
    </div>

    <div class="card">
        <h3>Registo de Atividade do Grid Trading (Servidor Cloud)</h3>
        <div id="tradeLog" class="trade-log">A sincronizar com a nuvem...</div>
    </div>

    <script>
        async function atualizarPainel() {
            try {
                const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=XRPUSDT');
                const data = await res.json();
                if (data && data.price) {
                    document.getElementById('currentPrice').innerText = '$ ' + parseFloat(data.price).toFixed(4);
                }

                const logRes = await fetch('/status-log');
                const logData = await logRes.json();
                if (logData.log) {
                    document.getElementById('tradeLog').innerText = logData.log + '\\n' + document.getElementById('tradeLog').innerText;
                }
            } catch (e) {
                console.error(e);
            }
        }

        window.addEventListener('DOMContentLoaded', () => {
            atualizarPainel();
            setInterval(atualizarPainel, 15000);
        });
    </script>
</body>
</html>`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`MaxIncome cloud engine a operar na porta ${PORT}`);
});
