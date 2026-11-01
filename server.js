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
            console.log("Alerta de ordem executada enviado para o Telegram com sucesso.");
        });
    });

    req.on('error', (e) => {
        console.error(`Erro ao enviar mensagem para o Telegram: ${e.message}`);
    });

    req.write(dados);
    req.end();
}

// --- ROTA DE WEBHOOK (DISPARA APENAS QUANDO HÁ ORDEM REAL EXECUTADA) ---
app.post('/webhook', (req, res) => {
    const dados = req.body;
    console.log("Ordem executada recebida via webhook:", dados);

    // Formata a mensagem estritamente para ordens de Compra ou Venda executadas
    const textoMensagem = `🟢 *ORDEM EXECUTADA NA CORRETORA*\n\n` +
                          `• *Ação:* ${dados.acao || 'EXECUTADO'}\n` +
                          `• *Par:* ${dados.par || 'XRP/USDT'}\n` +
                          `• *Preço:* ${dados.preco || 'N/A'}\n` +
                          `• *Horário:* ${dados.horario || 'N/A'}`;

    enviarMensagemTelegram(textoMensagem);
    res.status(200).json({ status: "sucesso", mensagem: "Notificação de ordem enviada!" });
});

app.get('/', (req, res) => {
    res.send('MaxIncome Backend de Ordens Reais a funcionar 24/7 na nuvem!');
});

// Tratamento de erros globais
process.on('uncaughtException', (err) => {
    console.error('Erro não capturado:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Rejeição não tratada:', reason);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de execução a rodar na porta ${PORT}`);
    console.log("A aguardar ordens reais da corretora via webhook...");
});
