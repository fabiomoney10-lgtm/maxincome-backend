const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Rota para o frontend obter as chaves (se necessário)
app.get('/get-keys', (req, res) => {
    res.json({
        apiKey: process.env.BYBIT_API_KEY || '',
        secretKey: process.env.BYBIT_SECRET_KEY || ''
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- MOTOR DE TRADING AUTÓNOMO NO BACKEND (Roda 24/7 na nuvem) ---
function gerarAssinaturaHMAC(secret, message) {
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

async function executarMotorNuvem() {
    const apiKey = process.env.BYBIT_API_KEY;
    const secretKey = process.env.BYBIT_SECRET_KEY;

    if (!apiKey || !secretKey) {
        console.log("[Robô Nuvem] Chaves API não configuradas no servidor.");
        return;
    }

    try {
        // 1. Obter preço atual do XRP via Binance Public API
        const priceRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=XRPUSDT');
        const priceData = await priceRes.json();
        if (!priceData || !priceData.price) return;
        const precoAtual = parseFloat(priceData.price);

        // 2. Obter timestamp global
        const timeRes = await fetch('https://api.binance.com/api/v3/time');
        const timeData = await timeRes.json();
        const serverTimestamp = timeData.serverTime ? timeData.serverTime.toString() : Date.now().toString();
        const recvWindow = '60000';

        // 3. Consultar saldos na Bybit
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

        console.log(`[Robô Nuvem] Preço XRP: $${precoAtual} | USDT: ${usdtDisponivel.toFixed(2)} | XRP: ${xrpDisponivel.toFixed(2)}`);

        // 4. Lógica de Execução (Vender se tiver XRP, Comprar se tiver USDT)
        if (xrpDisponivel >= 1.5) {
            // Preço alvo de venda fictício/dinâmico (+0.8%) - aqui assumimos alta baseada na última compra estimada
            console.log(`[Robô Nuvem] Monitorizando XRP para venda...`);
            // Se quiser forçar venda automática quando atingir alvo, pode aplicar aqui
        } else if (usdtDisponivel >= 1.0) {
            console.log(`[Robô Nuvem] Saldo USDT disponível detetado. A preparar compra na baixa...`);
            
            const bodyData = {
                category: "spot",
                symbol: "XRPUSDT",
                side: "Buy",
                orderType: "Market",
                qty: "2"
            };

            const jsonBody = JSON.stringify(bodyData);
            const signatureOrder = gerarAssinaturaHMAC(secretKey, serverTimestamp + apiKey + recvWindow + jsonBody);

            const orderResp = await fetch('https://api.bybit.com/v5/order/create', {
                method: 'POST',
                headers: {
                    'X-BAPI-API-KEY': apiKey,
                    'X-BAPI-SIGN': signatureOrder,
                    'X-BAPI-TIMESTAMP': serverTimestamp,
                    'X-BAPI-RECV-WINDOW': recvWindow,
                    'Content-Type': 'application/json'
                },
                body: jsonBody
            });
            const orderResult = await orderResp.json();
            console.log(`[Robô Nuvem] Resposta da Ordem de Compra:`, orderResult.retMsg);
        }

    } catch (e) {
        console.error("[Robô Nuvem Erro]:", e.message);
    }
}

// O robô executa sozinho a cada 30 segundos na nuvem 24/7, mesmo sem ninguém no site!
setInterval(executarMotorNuvem, 30000);

app.listen(PORT, () => {
    console.log(`Servidor e Motor Autónomo rodando na porta ${PORT}`);
});
