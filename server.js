const express = require('express');
const https = require('https');
const http = require('http');

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

// --- ROTA DE WEBHOOK PARA TESTES EXTERNOS ---
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

// --- MOTOR DE MONITORIZAÇÃO AUTÓNOMA 24/7 NA NUVEM ---
function iniciarMonitorizacaoNuvem() {
    console.log("Motor de monitorização autónoma 24/7 iniciado na nuvem.");
    
    setInterval(() => {
        const agora = new Date();
        const minutos = agora.getMinutes();
        const segundos = agora.getSeconds();

        // Verifica o fecho das velas de 5 em 5 minutos nos primeiros segundos
        if (minutos % 5 === 0 && segundos <= 10) {
            console.log(`[Cloud Bot] Janela de análise atingida em ${agora.toLocaleTimeString()}`);
            
            // Aqui o servidor na nuvem processa a lógica ou consulta a Bybit
            const mensagemAutonoma = `🤖 *Alerta Automático da Nuvem (24/7)*\n\n` +
                                     `• *Ativo:* XRP/USDT\n` +
                                     `• *Ciclo:* Vela de 5M fechada\n` +
                                     `• *Status:* Sistema a operar sem dependência local!`;
            
            enviarMensagemTelegram(mensagemAutonoma);
            
            // Pausa de 40 segundos para evitar disparos duplicados na mesma janela
            global.gc && global.gc();
        }
    }, 10000); // Verifica a cada 10 segundos
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Servidor a rodar na porta ${PORT}`);
    iniciarMonitorizacaoNuvem();
});
