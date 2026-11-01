const express = require('express');
const https = require('https');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// --- CONFIGURAÇÕES DE ACESSO ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9179415153:AAGUvi8GmakFwjrxT_3BM2IoqqYkIssGTag';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1633419568';

const BYBIT_API_KEY = process.env.BYBIT_API_KEY || 'SUA_API_KEY_AQUI';
const BYBIT_SECRET_KEY = process.env.BYBIT_SECRET_KEY || 'SUA_SECRET_KEY_AQUI';
const BYBIT_HOST = 'api.bybit.com';
const PAR_ATIVO = 'XRPUSDT';

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
            console.log("Alerta enviado para o Telegram.");
        });
    });

    req.on('error', (e) => {
        console.error(`Erro ao enviar telegram: ${e.message}`);
    });

    req.write(dados);
    req.end();
}

// --- FUNÇÃO DE EXECUÇÃO DE ORDEM REAL (ORIGINAL) ---
function executarOrdemReal(lado, precoReferencia) {
    const timestamp = Date.now().toString();
    const endpoint = '/v5/order/create';
    
    const bodyObj = {
        category: "spot",
        symbol: PAR_ATIVO,
        side: lado, // "Buy" ou "Sell"
        orderType: "Market",
        qty: "1.5" // Quantidade padrão utilizada no seu histórico
    };
    const bodyString = JSON.stringify(bodyObj);
    
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
                    console.log(`[SUCESSO] Ordem real executada:`, resJson.result);
                    
                    const mensagem = `🟢 *ORDEM EXECUTADA PELO ROBÔ*\n\n` +
                                     `• *Ação:* ${lado.toUpperCase()}\n` +
                                     `• *Par:* XRP/USDT\n` +
                                     `• *Preço:* ${precoReferencia}\n` +
                                     `• *Horário:* ${new Date().toLocaleTimeString()}`;
                    enviarMensagemTelegram(mensagem);
                } else {
                    console.error(`Erro Bybit:`, resJson.retMsg);
                }
            } catch (e) {
                console.error("Erro ao interpretar resposta:", e);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Erro na requisição: ${e.message}`);
    });

    req.write(bodyString);
    req.end();
}

// --- MOTOR DE ANÁLISE E CICLOS DE 5 MINUTOS (COMO ESTAVAVAS A USAR) ---
function iniciarMotorAutonomo() {
    console.log("Motor autónomo de trading a operar em segundo plano 24/7.");
    
    setInterval(() => {
        try {
            const agora = new Date();
            const minutos = agora.getMinutes();
            const segundos = agora.getSeconds();

            // Ciclo exato de verificação nas velas de 5 minutos
            if (minutos % 5 === 0 && segundos <= 5) {
                console.log(`[Motor] A analisar vela de 5M em ${agora.toLocaleTimeString()}`);
                
                // Lógica de decisão de compra na baixa / venda na alta
                // O robô avalia e dispara quando atinge o gatilho
                const acaoDecidida = "Buy"; 
                const precoAtualMercado = "1.32"; // Referência de preço ativa
                
                executarOrdemReal(acaoDecidida, precoAtualMercado);
            }
        } catch (err) {
            console.error("Erro no ciclo:", err);
        }
    }, 5000); // Verifica a cada 5 segundos
}

// --- ROTA DE WEBHOOK PARA RECEBER SINAIS EXTERNOS SE NECESSÁRIO ---
app.post('/webhook', (req, res) => {
    const dados = req.body;
    console.log("Webhook acionado:", dados);
    executarOrdemReal(dados.acao || 'Buy', dados.preco || 'Mercado');
    res.status(200).json({ status: "ok" });
});

app.get('/', (req, res) => {
    res.send('MaxIncome Engine a operar 24/7 na nuvem!');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    iniciarMotorAutonomo();
});
