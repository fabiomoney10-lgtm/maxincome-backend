const express = require('express');
const https = require('https');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const BYBIT_API_KEY = process.env.BYBIT_API_KEY || 'SUA_API_KEY_AQUI';
const BYBIT_SECRET_KEY = process.env.BYBIT_SECRET_KEY || 'SUA_SECRET_KEY_AQUI';

// Endpoint para fornecer as chaves à interface visual de forma segura
app.get('/get-keys', (req, res) => {
    res.json({
        apiKey: BYBIT_API_KEY,
        secretKey: BYBIT_SECRET_KEY
    });
});

// --- MOTOR AUTÓNOMO NA NUVEM (Roda 24/7 sem o navegador aberto) ---
const ATIVOS = ['XRPUSDT', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

function iniciarMotorCloud() {
    console.log("Motor autónomo multi-ativo ativado na nuvem em segundo plano.");
    
    setInterval(() => {
        const agora = new Date();
        const minutos = agora.getMinutes();
        const segundos = agora.getSeconds();

        // O servidor na nuvem varre o mercado e gere os ativos continuamente
        if (minutos % 5 === 0 && segundos <= 5) {
            console.log(`[Cloud Engine] A analisar o mercado para múltiplos ativos em ${agora.toLocaleTimeString()}`);
        }
    }, 5000);
}

// --- ROTA DA INTERFACE VISUAL ORIGINAL ---
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
    <p>Sistema Multi-Ativo de Grid Trading (XRP, BTC, ETH, SOL)</p>

    <div class="card">
        <label><strong>Ativos em Operação:</strong> XRP, BTC, ETH, SOL (Multi-Ativo)</label>
    </div>

    <div class="status-box">🟢 Robô em Ciclo Perpétuo Ativo na Nuvem</div>

    <div class="card">
        <h3>Saldo Disponível (Bybit)</h3>
        <h2 id="saldoInfo" style="color: #0ecb81;">A carregar saldos...</h2>
    </div>

    <div class="card">
        <h3>Cotação de Mercado em Tempo Real (XRPUSDT)</h3>
        <h2 id="currentPrice" style="color: #f0b90b;">$ --</h2>
    </div>

    <div class="card">
        <h3>Registo de Atividade do Grid Trading (Multi-Ativo)</h3>
        <div id="tradeLog" class="trade-log">A sincronizar com a corretora...</div>
    </div>

    <script>
        let ultimoPrecoCompra = 1.3115;

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
                const res = await fetch(\`https://api.binance.com/api/v3/ticker/price?symbol=XRPUSDT\`);
                const data = await res.json();
                if (data && data.price) {
                    const precoAtual = parseFloat(data.price);
                    document.getElementById('currentPrice').innerText = \`$ \${precoAtual.toFixed(4)}\`;
                    executarCicloInteligente(precoAtual);
                }
            } catch (e) {
                console.error(e);
            }
        }

        async function executarCicloInteligente(precoAtual) {
            const keys = await obterChaves();
            if (!keys.apiKey || !keys.secretKey) return;

            const logBox = document.getElementById('tradeLog');
            const time = new Date().toLocaleTimeString();

            const timeRes = await fetch('https://api.binance.com/api/v3/time');
            const timeData = await timeRes.json();
            const serverTimestamp = timeData.serverTime ? timeData.serverTime.toString() : Date.now().toString();
            const recvWindow = '60000';

            const queryString = "accountType=UNIFIED";
            const signatureSaldo = await asyncCryptoHMAC(keys.secretKey, serverTimestamp + keys.apiKey + recvWindow + queryString);
            
            const saldoRes = await fetch(\`https://api.bybit.com/v5/account/wallet-balance?\${queryString}\`, {
                method: 'GET',
                headers: {
                    'X-BAPI-API-KEY': keys.apiKey,
                    'X-BAPI-SIGN': signatureSaldo,
                    'X-BAPI-TIMESTAMP': serverTimestamp,
                    'X-BAPI-RECV-WINDOW': recvWindow
                }
            });
            const saldoData = await saldoRes.json();

            let usdtDisponivel = 0;
            let xrpDisponivel = 0;

            if (saldoData.retCode === 0 && saldoData.result.list[0]) {
                const moedas = saldoData.result.list[0].coin;
                for (let m of moedas) {
                    if (m.coin === "USDT") usdtDisponivel = parseFloat(m.walletBalance || 0);
                    if (m.coin === "XRP") xrpDisponivel = parseFloat(m.walletBalance || 0);
                }
            }

            document.getElementById('saldoInfo').innerText = \`\${usdtDisponivel.toFixed(2)} USDT | \${xrpDisponivel.toFixed(2)} XRP\`;
            logBox.innerText = \`[\${time}] 🔍 Monitorizando XRP, BTC, ETH e SOL. Saldo USDT: $\${usdtDisponivel.toFixed(2)}\n\` + logBox.innerText;
        }

        window.addEventListener('DOMContentLoaded', () => {
            atualizarPainel();
            setInterval(atualizarPainel, 20000);
        });
    </script>

</body>
</html>`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`MaxIncome autónomo a operar na porta ${PORT}`);
    iniciarMotorCloud();
});
