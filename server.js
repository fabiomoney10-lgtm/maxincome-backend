const express = require('express');
const https = require('https');

const app = express();
app.use(express.json());

// --- CONFIGURAÇÕES DO TELEGRAM ---
const TELEGRAM_BOT_TOKEN = '9179415153:AAGUvi8GmakFwjrxT_3BM2IoqqYkIssGTag';
const TELEGRAM_CHAT_ID = '1633419568';

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
            console.log("Mensagem enviada para o Telegram com sucesso.");
        });
    });

    req.on('error', (e) => {
        console.error(`Erro ao enviar mensagem para o Telegram: ${e.message}`);
    });

    req.write(dados);
    req.end();
}

// --- ROTA DE WEBHOOK ---
app.post('/webhook', (req, res) => {
    const dados = req.body;
    console.log("Webhook recebido:", dados);

    const textoMensagem = `🚨 *Sinal Recebido (Webhook)*\n\n` +
                          `• *Ação:* ${dados.acao || 'N/A'}\n` +
                          `• *Par:* ${dados.par || 'XRP/USDT'}\n` +
                          `• *Preço:* ${dados.preco || 'N/A'}\n` +
                          `• *Horário:* ${dados.horario || 'N/A'}`;

    enviarMensagemTelegram(textoMensagem);
    res.status(200).json({ status: "sucesso", mensagem: "Alerta enviado para o Telegram!" });
});

app.get('/', (req, res) => {
    res.send('MaxIncome Backend a funcionar 24/7 na nuvem!');
});

// --- MOTOR DE MONITORIZAÇÃO AUTÓNOMA 24/7 ---
const ATIVOS_MONITORADOS = ['XRP/USDT'];

function iniciarMonitorizacaoNuvem() {
    console.log("Motor de monitorização autónoma 24/7 iniciado na nuvem.");
    
    setInterval(() => {
        try {
            const agora = new Date();
            const minutos = agora.getMinutes();
            const segundos = agora.getSeconds();

            if (minutos % 5 === 0 && segundos <= 10) {
                console.log(`[Cloud Bot] Janela de análise atingida em ${agora.toLocaleTimeString()}`);
                
                ATIVOS_MONITORADOS.forEach((par) => {
                    const mensagemAutonoma = `🤖 *Alerta Automático (24/7)*\n\n` +
                                             `• *Ativo:* ${par}\n` +
                                             `• *Ciclo:* Vela de 5M fechada\n` +
                                             `• *Status:* Sistema a operar na nuvem!`;
                    
                    enviarMensagemTelegram(mensagemAutonoma);
                });
            }
        } catch (err) {
            console.error("Erro no ciclo de monitorização:", err);
        }
    }, 10000);
}

// Tratamento de erros globais para evitar fecho inesperado
process.on('uncaughtException', (err) => {
    console.error('Erro não capturado:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Rejeição não tratada:', reason);
});

const PORT = process.env.PORT || 10000;
// É obrigatório ligar a '0.0.0.0' no Render para aceitar conexões externas
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor a rodar na porta ${PORT}`);
    iniciarMonitorizacaoNuvem();
});
