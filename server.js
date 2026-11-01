const express = require('express');
const https = require('https');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// --- CONFIGURAÇÕES DA CORRETORA (BYBIT) E TELEGRAM ---
const BYBIT_API_KEY = 'SUA_API_KEY_AQUI';
const BYBIT_SECRET_KEY = 'SUA_SECRET_KEY_AQUI';
const BYBIT_HOST = 'api.bybit.com'; // Use api-testnet.bybit.com se estiver a testar em simulador

const TELEGRAM_BOT_TOKEN = '9179415153:AAGUvi8GmakFwjrxT_3BM2IoqqYkIssGTag';
const TELEGRAM_CHAT_ID = '1633419568';

const PAR_ATIVO = 'XRPUSDT'; // Formato exigido pela API da Bybit

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
            console.log("Alerta de ordem executada enviado para o Telegram.");
        });
    });

    req.on('error', (e) => {
        console.error(`Erro ao enviar telegram: ${e.message}`);
    });

    req.write(dados);
    req.end();
}

// Função para gerar assinatura HMAC exigida pela segurança da Bybit V5
function assinarRequisicao(paramsString, timestamp) {
    const signaturePayload = timestamp + BYBIT_API_KEY + '5000' + paramsString;
    return crypto.createHmac('sha256', BYBIT_SECRET_KEY).update(signaturePayload).digest('hex');
}

// Função para executar ordem real na Bybit
function executarOrdemReal(lado, precoAtual) {
    const timestamp = Date.now().toString();
    const endpoint = '/v5/order/create';
    
    const bodyObj = {
        category: "spot",
        symbol: PAR_ATIVO,
        side: lado, // "Buy" ou "Sell"
        orderType: "Market",
        qty: "5.0" // Quantidade ajustável por operação
    };
    const bodyString = JSON.stringify(bodyObj);
    
    // Assinatura para pedidos POST na Bybit V5
    const signaturePayload = timestamp + BYBIT_API_KEY + '5000' + bodyString;
    const signature = crypto.createHmac('sha256', BYBIT_SECRET_KEY).update(signaturePayload).digest('hex');

    const options = {
        hostname: BYBIT_HOST,
        path: endpoint,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-BAPI-API-KEY': BYBIT_API_KEY,
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-SIGN': signature,
            'X-BAPI-RECV-WINDOW': '5000'
        }
    };

    const req = https.request(options, (res) => {
        let resposta = '';
        res.on('data', (chunk) => { resposta += chunk; });
        res.on('end', () => {
            try {
                const resJson = JSON.parse(resposta);
                if (resJson.retCode === 0) {
                    console.log(`[SUCESSO] Ordem real executada na Bybit:`, resJson.result);
                    
                    // DISPARA O ALERTA PARA O TELEGRAM APENAS APÓS A EXECUÇÃO REAL
                    const mensagem = `🚨 *ORDEM REAL EXECUTADA*\n\n` +
                                     `• *Ação:* ${lado.toUpperCase()}\n` +
                                     `• *Par:* XRP/USDT\n` +
                                     `• *Preço:* ${precoAtual}\n` +
                                     `• *Horário:* ${new Date().toLocaleTimeString()}`;
                    enviarMensagemTelegram(mensagem);
                } else {
                    console.error(`Erro retornado pela Bybit:`, resJson.retMsg);
                }
            } catch (e) {
                console.error("Erro ao interpretar resposta da Bybit:", e);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Erro na requisição à Bybit: ${e.message}`);
    });

    req.write(bodyString);
    req.end();
}

// --- MOTOR DE MONITORIZAÇÃO AUTÓNOMA 24/7 ---
function iniciarMonitorizacaoNuvem() {
    console.log("Motor de execução autónoma de ordens reais ativo na nuvem.");
    
    setInterval(() => {
        try {
            const agora = new Date();
            const minutos = agora.getMinutes();
            const segundos = agora.getSeconds();

            // Respeita a regra temporal: fecho da vela de 5M nos primeiros segundos
            if (minutos % 5 === 0 && segundos <= 10) {
                console.log(`[Cloud Engine] Janela atingida em ${agora.toLocaleTimeString()}. A consultar mercado...`);
                
                // Exemplo de chamada para obter preço e decidir o sinal (Compra ou Venda)
                // Aqui o robô executa a ordem real baseada na estratégia:
                const acaoBot = "Buy"; // O seu algoritmo decide se é Buy ou Sell
                const precoReferencia = "1.32"; // Preço obtido da análise
                
                executarOrdemReal(acaoBot, precoReferencia);
            }
        } catch (err) {
            console.error("Erro no ciclo de ordens:", err);
        }
    }, 10000); // Verifica a cada 10 segundos
}

app.get('/', (req, res) => {
    res.send('MaxIncome Engine de Ordens Reais a operar 24/7!');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de execução a rodar na porta ${PORT}`);
    iniciarMonitorizacaoNuvem();
});
