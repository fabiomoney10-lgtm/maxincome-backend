const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/get-keys', (req, res) => {
    res.json({
        apiKey: process.env.BYBIT_API_KEY || '',
        secretKey: process.env.BYBIT_SECRET_KEY || ''
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

function gerarAssinaturaHMAC(secret, message) {
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

let ultimoPrecoCompra = 1.3115;

// Função matemática para calcular a volatilidade (ATR simplificado) baseada nas últimas velas
async function calcularFatorVolatilidade() {
    try {
        const res = await fetch('https://api.binance.com/api/v3/klines?symbol=XRPUSDT&interval=15m&limit=10');
        const klines = await res.json();
        if (!Array.isArray(klines) || klines.length === 0) return 0.008; // Valor padrão de segurança (0.8%)

        let somaRanges = 0;
        for (let candle of klines) {
            const high = parseFloat(candle[2]);
            const low = parseFloat(candle[3]);
            const close = parseFloat(candle[4]);
            const range = (high - low) / close; // Amplitude percentual da vela
            somaRanges += range;
        }

        const mediaVolatilidade = somaRanges / klines.length;
        
        // O lucro alvo será proporcional à volatilidade detetada (mínimo de 0.5%, máximo de 2%)
        let fatorAlvo = mediaVolatilidade * 0.8; 
        if (fatorAlvo < 0.005) fatorAlvo = 0.005;
        if (fatorAlvo > 0.02) fatorAlvo = 0.02;

        return fatorAlvo;
    } catch (e) {
        return 0.008; // Fallback de segurança
    }
}

async function executarMotorNuvem() {
    const apiKey = process.env.BYBIT_API_KEY;
    const secretKey = process.env.BYBIT_SECRET_KEY;

    if (!apiKey || !secretKey) {
        console.log("[Robô Nuvem ATR] Chaves API não configuradas.");
        return;
    }

    try {
        const priceRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=XRPUSDT');
        const priceData = await priceRes.json();
        if (!priceData || !priceData.price) return;
        const precoAtual = parseFloat(priceData.price);

        const timeRes = await fetch('https://api.binance.com/api/v3/time');
        const timeData = await timeRes.json();
        const serverTimestamp = timeData.serverTime ? timeData.serverTime.toString() : Date.now().toString();
        const recvWindow = '60000';

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

        // Calcula a margem de lucro dinâmica com base no ATR
        const percentualLucroDinamico = await calcularFatorVolatilidade();
        console.log(`[Robô ATR] XRP: $${precoAtual} | Volatilidade Alvo: ${(percentualLucroDinamico*100).toFixed(2)}% | USDT: ${usdtDisponivel.toFixed(2)} | XRP: ${xrpDisponivel.toFixed(2)}`);

        if (xrpDisponivel >= 1.5) {
            const alvoLucro = ultimoPrecoCompra * (1 + percentualLucroDinamico);
            if (precoAtual >= alvoLucro) {
                console.log(`[Robô ATR] Alvo dinâmico atingido ($${precoAtual} >= $${alvoLucro.toFixed(4)}). A vender...`);

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
                console.log(`[Robô ATR] Resposta Venda:`, resJson.retMsg);
            }
        } else if (usdtDisponivel >= 1.0) {
            console.log(`[Robô ATR] Saldo USDT detetado. A preparar compra na baixa...`);

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
            console.log(`[Robô ATR] Resposta Compra:`, resJson.retMsg);
        }

    } catch (e) {
        console.error("[Robô ATR Erro]:", e.message);
    }
}

setInterval(executarMotorNuvem, 30000);

app.listen(PORT, () => {
    console.log(`Servidor com Motor ATR Autónomo rodando na porta ${PORT}`);
});
