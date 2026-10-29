const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Rota para fornecer chaves (caso o painel precise)
app.get('/get-keys', (req, res) => {
    res.json({
        apiKey: process.env.BYBIT_API_KEY || '',
        secretKey: process.env.BYBIT_SECRET_KEY || ''
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- MOTOR DE TRADING AUTÓNOMO NO BACKEND (Roda na nuvem 24/7) ---
function gerarAssinaturaHMAC(secret, message) {
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

let ultimoPrecoCompra = 1.3115; // Preço base de referência

async function executarMotorNuvem() {
    const apiKey = process.env.BYBIT_API_KEY;
    const secretKey = process.env.BYBIT_SECRET_KEY;

    if (!apiKey || !secretKey) {
        console.log("[Robô Nuvem] Chaves API não configuradas nas variáveis de ambiente do Render.");
        return;
    }

    try {
        // 1. Obter preço atual do XRP
        const priceRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=XRPUSDT');
        const priceData = await priceRes.json();
        if (!priceData || !priceData.price) return;
        const precoAtual = parseFloat(priceData.price);

        // 2. Obter timestamp global
        const timeRes = await fetch('https://api.binance.com/api/v3/time');
        const timeData = await timeRes.json();
        const serverTimestamp = timeData.serverTime ? timeData.serverTime.toString() : Date.now().toString();
        const recvWindow = '60000';

        // 3. Consultar saldos reais na Bybit
        const queryString = "accountType=UNIFIED";
        const signatureSaldo = gerarAssinaturaHMAC(secretKey, serverTimestamp + apiKey + recvWindow + queryString);

        const saldoRes = await fetch(`https://api.bybit.com/v5/account/wallet-balance?${queryString}`, {
            method: 'GET',
            headers: {
                'X-BAPI-API-KEY': apiKey,
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

        console.log(`[Robô Nuvem] XRP: $${precoAtual} | USDT: ${usdtDisponivel.toFixed(2)} | XRP Disp: ${xrpDisponivel.toFixed(2)}`);

        // 4. Ciclo da Roda Gigante autónomo
        if (xrpDisponivel >= 1.5) {
            const alvoLucro = ultimoPrecoCompra * 1.008; // Alvo +0.8%
            if (precoAtual >= alvoLucro) {
                console.log(`[Robô Nuvem] Alvo atingido ($${precoAtual} >= $${alvoLucro}). A enviar ordem de VENDA...`);

                const bodyData = {
                    category: "spot",
                    symbol: "XRPUSDT",
                    side: "Sell",
                    orderType: "Market",
                    qty: Math.floor(xrpDisponivel).toString()
                };

                const jsonBody = JSON.stringify(bodyData);
                const sigOrder = gerarAssinaturaHMAC(secretKey, serverTimestamp + apiKey + recvWindow + jsonBody);

                const resp = await fetch('https://api.bybit.com/v5/order/create', {
                    method: 'POST',
                    headers: {
                        'X-BAPI-API-KEY': apiKey,
                        'X-BAPI-SIGN': sigOrder,
                        'X-BAPI-TIMESTAMP': serverTimestamp,
                        'X-BAPI-RECV-WINDOW': recvWindow,
                        'Content-Type': 'application/json'
                    },
                    body: jsonBody
                });
                const resJson = await resp.json();
                console.log(`[Robô Nuvem] Resposta Venda:`, resJson.retMsg);
            }
        } else if (usdtDisponivel >= 1.0) {
            console.log(`[Robô Nuvem] Saldo USDT disponível. A enviar ordem de COMPRA...`);

            const bodyData = {
                category: "spot",
                symbol: "XRPUSDT",
                side: "Buy",
                orderType: "Market",
                qty: "2"
            };

            const jsonBody = JSON.stringify(bodyData);
            const sigOrder = gerarAssinaturaHMAC(secretKey, serverTimestamp + apiKey + recvWindow + jsonBody);

            const resp = await fetch('https://api.bybit.com/v5/order/create', {
                method: 'POST',
                    headers: {
                    'X-BAPI-API-KEY': apiKey,
                    'X-BAPI-SIGN': sigOrder,
                    'X-BAPI-TIMESTAMP': serverTimestamp,
                    'X-BAPI-RECV-WINDOW': recvWindow,
                    'Content-Type': 'application/json'
                },
                body: jsonBody
            });
            const resJson = await resp.json();
            if (resJson.retCode === 0) {
                ultimoPrecoCompra = precoAtual;
            }
            console.log(`[Robô Nuvem] Resposta Compra:`, resJson.retMsg);
        }

    } catch (e) {
        console.error("[Robô Nuvem Erro]:", e.message);
    }
}

// O motor executa sozinho na nuvem a cada 30 segundos, sem precisar do navegador aberto!
setInterval(executarMotorNuvem, 30000);

app.listen(PORT, () => {
    console.log(`Servidor e Motor Autónomo rodando na porta ${PORT}`);
});
