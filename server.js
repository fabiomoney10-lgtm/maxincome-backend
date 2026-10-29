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
let precoMaximoAtingido = 0; // Variável de rastreio para o Trailing Stop

// 1. Cálculo do ATR (Volatilidade Dinâmica)
async function calcularFatorVolatilidade() {
    try {
        const res = await fetch('https://api.binance.com/api/v3/klines?symbol=XRPUSDT&interval=15m&limit=10');
        const klines = await res.json();
        if (!Array.isArray(klines) || klines.length === 0) return 0.008;

        let somaRanges = 0;
        for (let candle of klines) {
            const high = parseFloat(candle[2]);
            const low = parseFloat(candle[3]);
            const close = parseFloat(candle[4]);
            somaRanges += (high - low) / close;
        }

        const mediaVolatilidade = somaRanges / klines.length;
        let fatorAlvo = mediaVolatilidade * 0.8; 
        if (fatorAlvo < 0.005) fatorAlvo = 0.005;
        if (fatorAlvo > 0.02) fatorAlvo = 0.02;

        return fatorAlvo;
    } catch (e) {
        return 0.008;
    }
}

// 2. Filtro de Tendência (EMA 20)
async function verificarTendenciaAlta() {
    try {
        const res = await fetch('https://api.binance.com/api/v3/klines?symbol=XRPUSDT&interval=15m&limit=25');
        const klines = await res.json();
        if (!Array.isArray(klines) || klines.length < 20) return true;

        const precosFecho = klines.map(c => parseFloat(c[4]));
        const k = 2 / (20 + 1);
        let ema = precosFecho[0];
        for (let i = 1; i < precosFecho.length; i++) {
            ema = (precosFecho[i] * k) + (ema * (1 - k));
        }

        const precoAtual = precosFecho[precosFecho.length - 1];
        return precoAtual >= (ema * 0.992);
    } catch (e) {
        return true; 
    }
}

async function executarMotorNuvem() {
    const apiKey = process.env.BYBIT_API_KEY;
    const secretKey = process.env.BYBIT_SECRET_KEY;

    if (!apiKey || !secretKey) {
        console.log("[Robô Nuvem Trailing] Chaves API não configuradas.");
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

        const percentualLucroDinamico = await calcularFatorVolatilidade();
        const tendenciaFavoravel = await verificarTendenciaAlta();

        console.log(`[Robô Trailing] XRP: $${precoAtual} | USDT: ${usdtDisponivel.toFixed(2)} | XRP: ${xrpDisponivel.toFixed(2)}`);

        if (xrpDisponivel >= 1.5) {
            const alvoInicialLucro = ultimoPrecoCompra * (1 + percentualLucroDinamico);

            // Atualiza o topo máximo atingido caso o preço suba
            if (precoAtual > precoMaximoAtingido) {
                precoMaximoAtingido = precoAtual;
            }

            // Define o gatilho do Trailing Stop (permite recuo máximo de 0.4% a partir do topo máximo)
            const gatilhoTrailing = precoMaximoAtingido * 0.996;

            // Condição de Venda: Atingiu o alvo inicial E o preço começou a recuar do topo (ou ultrapassou o alvo com força)
            if (precoAtual >= alvoInicialLucro && precoAtual <= gatilhoTrailing) {
                console.log(`[Robô Trailing] Topo máximo: $${precoMaximoAtingido} | Recuo detetado. A executar VENDA com lucro máximo...`);

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
                
                if (resJson.retCode === 0) {
                    precoMaximoAtingido = 0; // Reseta para o próximo ciclo
                }
                console.log(`[Robô Trailing] Resposta Venda:`, resJson.retMsg);
            }
        } else if (usdtDisponivel >= 1.0 && tendenciaFavoravel) {
            // Juros Compostos (35% do capital disponível)
            const capitalAlocadoUSDT = usdtDisponivel * 0.35;
            let quantidadeParaComprar = Math.floor(capitalAlocadoUSDT / precoAtual);
            if (quantidadeParaComprar < 1) quantidadeParaComprar = 1;

            console.log(`[Robô Trailing] A executar compra com juros compostos: ${quantidadeParaComprar} XRP...`);

            const bodyData = {
                category: "spot",
                symbol: "XRPUSDT",
                side: "Buy",
                orderType: "Market",
                qty: quantidadeParaComprar.toString()
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
                precoMaximoAtingido = precoAtual; // Inicializa o rastreio do topo
            }
            console.log(`[Robô Trailing] Resposta Compra:`, resJson.retMsg);
        }

    } catch (e) {
        console.error("[Robô Trailing Erro]:", e.message);
    }
}

setInterval(executarMotorNuvem, 30000);

app.listen(PORT, () => {
    console.log(`Servidor com Trailing Stop Autónomo rodando na porta ${PORT}`);
});
