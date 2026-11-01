const express = require('express');
const https = require('https');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const BYBIT_API_KEY = process.env.BYBIT_API_KEY || 'SUA_API_KEY_AQUI';
const BYBIT_SECRET_KEY = process.env.BYBIT_SECRET_KEY || 'SUA_SECRET_KEY_AQUI';
const BYBIT_HOST = 'api.bybit.com';

const ATIVOS = ['XRPUSDT', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
let ativoAtualIndex = 0;
let dadosLog = "Servidor autónomo multi-ativo a operar na nuvem 24/7.";
let cotacoesAtivas = {};

function asyncCryptoHMAC(secret, message) {
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

// --- MOTOR AUTÓNOMO MULTI-ATIVO NA NUVEM ---
async function executarMotorCloud() {
    if (!BYBIT_API_KEY || BYBIT_API_KEY === 'SUA_API_KEY_AQUI') {
        dadosLog = "[Erro] Chaves da Bybit em falta no servidor.";
        return;
    }

    try {
        // Roda pelos ativos da lista (XRP, BTC, ETH, SOL)
        const simbolo = ATIVOS[ativoAtualIndex];
        ativoAtualIndex = (ativoAtualIndex + 1) % ATIVOS.length;

        // 1. Obter preço atual do ativo na Bybit
        const priceRes = await new Promise((resolve) => {
            https.get(`https://${BYBIT_HOST}/v5/market/tickers?category=spot&symbol=${simbolo}`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', () => resolve(null));
        });

        const priceJson = JSON.parse(priceRes);
        if (!priceJson.result || !priceJson.result.list[0]) return;
        const precoAtual = parseFloat(priceJson.result.list[0].lastPrice);
        cotacoesAtivas[simbolo] = precoAtual;

        // 2. Obter saldos da conta Bybit
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
        let qtdAtivo = 0;

        if (saldoData.retCode === 0 && saldoData.result.list[0]) {
            const moedas = saldoData.result.list[0].coin;
            for (let m of moedas) {
                if (m.coin === "USDT") usdtDisponivel = parseFloat(m.walletBalance || 0);
                const moedaAlvo = simbolo.replace('USDT', '');
                if (m.coin === moedaAlvo) qtdAtivo = parseFloat(m.walletBalance || 0);
            }
        }

        const time = new Date().toLocaleTimeString();
        dadosLog = `[${time}] 🔍 A analisar ativo: ${simbolo} | Preço: $${precoAtual} | USDT: $${usdtDisponivel.toFixed(2)}`;

    } catch (e) {
        console.error("Erro no motor multi-ativo:", e);
    }
}

setInterval(executarMotorCloud, 15000);

app.get('/status-log', (req, res) => {
    res.json({ log: dadosLog, cotacoes: cotacoesAtivas });
});

app.get('/get-keys', (req, res) => {
    res.json({ apiKey: BYBIT_API_KEY, secretKey: BYBIT_SECRET_KEY });
});

// --- PAINEL VISUAL MULTI-ATIVO ---
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <title>MaxIncome - Grid Trading Multi-Ativo 24/7</title>
    <style>
        body { background-color: #131722; color: #d1d4dc; font-family: Arial, sans-serif; text-align: center; margin: 0; padding: 20px; }
        h1 { color: #f0b90b; }
        .card { background: #1e222d; padding: 20px; margin: 15px auto; width: 65%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .status-box { color: #0ecb81; font-weight: bold; margin-bottom: 20px; font-size: 16px; }
        .trade-log { background: #11141d; padding: 15px; border-radius: 5px; margin-top: 10px; font-family: monospace; color: #0ecb81; text-align: left; max-height: 240px; overflow-y: auto; font-size: 13px; line-height: 1.5; }
        .prices-grid { display: flex; justify-content: space-around; flex-wrap: wrap; gap: 10px; }
        .price-item { background: #131722; padding: 10px; border-radius: 5px; width: 20%; min-width: 120px; border: 1px solid #30363d; }
    </style>
</head>
<body>

    <h1>MaxIncome - Nuvem Autónoma 24/7</h1>
    <p>Sistema Multi-Ativo de Grid Trading (XRP, BTC, ETH, SOL)</p>

    <div class="card">
        <label><strong>Ativos em Operação Simultânea:</strong> XRP, BTC, ETH, SOL</label>
    </div>

    <div class="status-box">🟢 Robô em Ciclo Multi-Ativo Ativo na Nuvem (24/7)</div>

    <div class="card">
        <h3>Saldo Disponível (Bybit)</h3>
        <h2 id="saldoInfo" style="color: #0ecb81;">A carregar saldos...</h2>
    </div>

    <div class="card">
        <h3>Cotações de Mercado em Tempo Real</h3>
        <div class="prices-grid" id="pricesGrid">
            <div class="price-item"><b>XRP:</b> <span id="p-XRPUSDT">$ --</span></div>
            <div class="price-item"><b>BTC:</b> <span id="p-BTCUSDT">$ --</span></div>
            <div class="price-item"><b>ETH:</b> <span id="p-ETHUSDT">$ --</span></div>
            <div class="price-item"><b>SOL:</b> <span id="p-SOLUSDT">$ --</span></div>
        </div>
    </div>

    <div class="card">
        <h3>Registo de Atividade do Grid Trading (Multi-Ativo)</h3>
        <div id="tradeLog" class="trade-log">A sincronizar com a nuvem...</div>
    </div>

    <script>
        async function asyncCryptoHMAC(secret, message) {
            const enc = new TextEncoder();
            const key = await crypto.subtle.importKey(
                "raw", enc.encode(secret), { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"]
            );
            const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
            return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
        }

        async function obterChaves() {
            const res = await fetch('/get-keys');
            return await res.json();
        }

        async function atualizarPainel() {
            try {
                // Atualizar cotações de todos os ativos via Bybit public ticker
                ['XRPUSDT', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT'].forEach(async (simbolo) => {
                    const res = await fetch('https://api.bybit.com/v5/market/tickers?category=spot&symbol=' + simbolo);
                    const data = await res.json();
                    if (data.retCode === 0 && data.result.list[0]) {
                        const preco = parseFloat(data.result.list[0].lastPrice).toFixed(2);
                        const el = document.getElementById('p-' + simbolo);
                        if (el) el.innerText = '$ ' + preco;
                    }
                });

                // Puxar saldos reais
                const keys = await obterChaves();
                if (keys.apiKey && keys.secretKey) {
                    const timeRes = await fetch('https://api.binance.com/api/v3/time');
                    const timeData = await timeRes.json();
                    const serverTimestamp = timeData.serverTime ? timeData.serverTime.toString() : Date.now().toString();
                    const recvWindow = '60000';
                    const queryString = "accountType=UNIFIED";
                    const signatureSaldo = await asyncCryptoHMAC(keys.secretKey, serverTimestamp + keys.apiKey + recvWindow + queryString);
                    
                    const saldoRes = await fetch('https://api.bybit.com/v5/account/wallet-balance?' + queryString, {
                        method: 'GET',
                        headers: {
                            'X-BAPI-API-KEY': keys.apiKey,
                            'X-BAPI-SIGN': signatureSaldo,
                            'X-BAPI-TIMESTAMP': serverTimestamp,
                            'X-BAPI-RECV-WINDOW': recvWindow
                        }
                    });
                    const saldoData = await saldoRes.json();
                    let usdt = 0, xrp = 0, btc = 0, eth = 0, sol = 0;
                    if (saldoData.retCode === 0 && saldoData.result.list[0]) {
                        for (let m of saldoData.result.list[0].coin) {
                            if (m.coin === "USDT") usdt = parseFloat(m.walletBalance || 0);
                            if (m.coin === "XRP") xrp = parseFloat(m.walletBalance || 0);
                            if (m.coin === "BTC") btc = parseFloat(m.walletBalance || 0);
                            if (m.coin === "ETH") eth = parseFloat(m.walletBalance || 0);
                            if (m.coin === "SOL") sol = parseFloat(m.walletBalance || 0);
                        }
                        document.getElementById('saldoInfo'.innerText = usdt.toFixed(2) + ' USDT | XRP: ' + xrp.toFixed(2) + ' | BTC: ' + btc.toFixed(4));
                    }
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
    console.log(`MaxIncome multi-ativo cloud engine a operar na porta ${PORT}`);
});
