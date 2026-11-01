const express = require('express');
const https = require('https');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const BYBIT_API_KEY = process.env.BYBIT_API_KEY || '';
const BYBIT_SECRET_KEY = process.env.BYBIT_SECRET_KEY || '';
const BYBIT_HOST = 'api.bybit.com';

const ATIVOS = ['XRPUSDT', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
let ativoAtualIndex = 0;
let dadosLog = "Servidor autónomo a iniciar ligação à Bybit...";
let cotacoesAtivas = { XRPUSDT: 0, BTCUSDT: 0, ETHUSDT: 0, SOLUSDT: 0 };
let ultimoSaldoFormatado = "A ligar à corretora...";

function asyncCryptoHMAC(secret, message) {
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

async function executarMotorCloud() {
    if (!BYBIT_API_KEY || !BYBIT_SECRET_KEY) {
        dadosLog = "[Erro Crítico] Chaves da Bybit em falta nas Variáveis de Ambiente do Render!";
        ultimoSaldoFormatado = "Erro: Chaves em falta no Render";
        return;
    }

    try {
        const simbolo = ATIVOS[ativoAtualIndex];
        ativoAtualIndex = (ativoAtualIndex + 1) % ATIVOS.length;

        // 1. Buscar cotações de todos os ativos para o painel não ficar a zeros
        for (let ativo of ATIVOS) {
            const priceRes = await new Promise((resolve) => {
                https.get(`https://${BYBIT_HOST}/v5/market/tickers?category=spot&symbol=${ativo}`, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve(data));
                }).on('error', () => resolve(null));
            });
            const priceJson = JSON.parse(priceRes);
            if (priceJson.result && priceJson.result.list[0]) {
                cotacoesAtivas[ativo] = parseFloat(priceJson.result.list[0].lastPrice);
            }
        }

        // 2. Buscar saldos na Bybit
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
        let usdt = 0, xrp = 0, btc = 0, eth = 0, sol = 0;

        if (saldoData.retCode === 0 && saldoData.result.list[0]) {
            const moedas = saldoData.result.list[0].coin;
            for (let m of moedas) {
                if (m.coin === "USDT") usdt = parseFloat(m.walletBalance || 0);
                if (m.coin === "XRP") xrp = parseFloat(m.walletBalance || 0);
                if (m.coin === "BTC") btc = parseFloat(m.walletBalance || 0);
                if (m.coin === "ETH") eth = parseFloat(m.walletBalance || 0);
                if (m.coin === "SOL") sol = parseFloat(m.walletBalance || 0);
            }
            ultimoSaldoFormatado = `${usdt.toFixed(2)} USDT | XRP: ${xrp.toFixed(2)} | BTC: ${btc.toFixed(4)} | ETH: ${eth.toFixed(4)} | SOL: ${sol.toFixed(2)}`;
            const time = new Date().toLocaleTimeString();
            dadosLog = `[${time}] 🔍 Sincronizado com sucesso! A monitorizar ativos. USDT: $${usdt.toFixed(2)}`;
        } else {
            ultimoSaldoFormatado = `Erro na API Bybit: ${saldoData.retMsg || 'Falha de autenticação'}`;
            dadosLog = `[Erro Bybit] ${saldoData.retMsg || 'Verifique as chaves API'}`;
        }

    } catch (e) {
        console.error("Erro no motor cloud:", e);
    }
}

// Executa imediatamente ao iniciar e depois a cada 10 segundos
executarMotorCloud();
setInterval(executarMotorCloud, 10000);

app.get('/status-cloud', (req, res) => {
    res.json({
        log: dadosLog,
        cotacoes: cotacoesAtivas,
        saldo: ultimoSaldoFormatado
    });
});

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
        <h2 id="saldoInfo" style="color: #0ecb81;">A ligar à corretora...</h2>
    </div>

    <div class="card">
        <h3>Cotações de Mercado em Tempo Real</h3>
        <div class="prices-grid">
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
        async function atualizarPainel() {
            try {
                const res = await fetch('/status-cloud');
                const data = await res.json();
                
                if (data.saldo) {
                    document.getElementById('saldoInfo').innerText = data.saldo;
                }
                if (data.log) {
                    document.getElementById('tradeLog').innerText = data.log + '\\n' + document.getElementById('tradeLog').innerText;
                }
                if (data.cotacoes) {
                    if (data.cotacoes.XRPUSDT) document.getElementById('p-XRPUSDT').innerText = '$ ' + data.cotacoes.XRPUSDT.toFixed(2);
                    if (data.cotacoes.BTCUSDT) document.getElementById('p-BTCUSDT').innerText = '$ ' + data.cotacoes.BTCUSDT.toFixed(2);
                    if (data.cotacoes.ETHUSDT) document.getElementById('p-ETHUSDT').innerText = '$ ' + data.cotacoes.ETHUSDT.toFixed(2);
                    if (data.cotacoes.SOLUSDT) document.getElementById('p-SOLUSDT').innerText = '$ ' + data.cotacoes.SOLUSDT.toFixed(2);
                }
            } catch (e) {
                console.error(e);
            }
        }

        window.addEventListener('DOMContentLoaded', () => {
            atualizarPainel();
            setInterval(atualizarPainel, 4000);
        });
    </script>
</body>
</html>`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`MaxIncome cloud engine a operar na porta ${PORT}`);
});
