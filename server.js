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

// Lista de Ativos em Operação (Multi-Ativos)
const ATIVOS = ["XRPUSDT", "SOLUSDT", "ETHUSDT"];
let precosCompra = { "XRPUSDT": 1.3115, "SOLUSDT": 120.0, "ETHUSDT": 2500.0 };
let precosMaximos = { "XRPUSDT": 0, "SOLUSDT": 0, "ETHUSDT": 0 };

// 1. Cálculo de Volatilidade (ATR) por ativo
async function calcularFatorVolatilidade(symbol) {
    try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&limit=10`);
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

// 2. Filtro de Tendência (EMA 20) por ativo
async function verificarTendenciaAlta(symbol) {
    try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&limit=25`);
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
        console.log("[Robô Multi-Ativos] Chaves API não configuradas.");
        return;
    }

    try {
        const timeRes = await fetch('https://api.binance.com/api/v3/time');
        const timeData = await timeRes.json();
        const serverTimestamp = timeData.serverTime ? timeData.serverTime.toString() : Date.now().toString();
        const recvWindow = '60000';

        // Consultar saldos unificados na Bybit
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
        let saldosMoedas = {};

        if (saldoData.retCode === 0 && saldoData.result.list[0]) {
            const moedas = saldoData.result.list[0].coin;
            for (let m of moedas) {
                if (m.coin === "USDT") usdtDisponivel = parseFloat(m.walletBalance || 0);
                saldosMoedas[m.coin] = parseFloat(m.walletBalance || 0);
            }
        }

        // Loop por cada ativo do portfólio
        for (let symbol of ATIVOS) {
            const moedaBase = symbol.replace("USDT", "");
            
            const priceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
            const priceData = await priceRes.json();
            if (!priceData || !priceData.price) continue;
            const precoAtual = parseFloat(priceData.price);

            const qtdAtivo = saldosMoedas[moedaBase] || 0;
            const percentualLucroDinamico = await calcularFatorVolatilidade(symbol);
            const tendenciaFavoravel = await verificarTendenciaAlta(symbol);

            console.log(`[Multi-Ativos] ${symbol} | Preço: $${precoAtual} | Saldo: ${qtdAtivo} | USDT: ${usdtDisponivel.toFixed(2)}`);

            // Lógica de Venda (Trailing Stop + ATR)
            const limiteMinimoVenda = (symbol === "ETHUSDT") ? 0.005 : (symbol === "SOLUSDT") ? 0.02 : 1.5;
            if (qtdAtivo >= limiteMinimoVenda) {
                const baseCompra = precosCompra[symbol] || precoAtual;
                const alvoInicialLucro = baseCompra * (1 + percentualLucroDinamico);

                if (precoAtual > (precosMaximos[symbol] || 0)) {
                    precosMaximos[symbol] = precoAtual;
                }

                const gatilhoTrailing = precosMaximos[symbol] * 0.996;

                if (precoAtual >= alvoInicialLucro && precoAtual <= gatilhoTrailing) {
                    console.log(`[Multi-Ativos] ${symbol} atingiu alvo de lucro com Trailing Stop. A vender...`);

                    const bodyData = {
                        category: "spot",
                        symbol: symbol,
                        side: "Sell",
                        orderType: "Market",
                        qty: (symbol === "ETHUSDT" || symbol === "SOLUSDT") ? qtdAtivo.toFixed(3) : Math.floor(qtdAtivo).toString()
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
                        precosMaximos[symbol] = 0;
                    }
                }
            } 
            // Lógica de Compra (Juros Compostos + EMA)
            else if (usdtDisponivel >= 3.0 && tendenciaFavoravel) {
                const capitalAlocadoUSDT = usdtDisponivel * 0.25; // 25% do USDT disponível por ativo
                let qtdComprar = capitalAlocadoUSDT / precoAtual;

                if (symbol === "XRPUSDT" && qtdComprar < 1) qtdComprar = 1;
                if (symbol === "SOLUSDT" && qtdComprar < 0.05) qtdComprar = 0.05;
                if (symbol === "ETHUSDT" && qtdComprar < 0.001) qtdComprar = 0.001;

                console.log(`[Multi-Ativos] A executar compra de ${symbol}...`);

                const bodyData = {
                    category: "spot",
                    symbol: symbol,
                    side: "Buy",
                    orderType: "Market",
                    qty: (symbol === "ETHUSDT") ? qtdComprar.toFixed(4) : (symbol === "SOLUSDT") ? qtdComprar.toFixed(3) : Math.floor(qtdComprar).toString()
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
                    precosCompra[symbol] = precoAtual;
                    precosMaximos[symbol] = precoAtual;
                    break; // Executa uma compra por ciclo para preservar caixa
                }
            }
        }

    } catch (e) {
        console.error("[Robô Multi-Ativos Erro]:", e.message);
    }
}

setInterval(executarMotorNuvem, 35000);

app.listen(PORT, () => {
    console.log(`Servidor Multi-Ativos Autónomo rodando na porta ${PORT}`);
});
