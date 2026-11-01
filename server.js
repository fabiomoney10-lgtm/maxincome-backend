const express = require('express');
const app = express();

app.use(express.json());

// Configurações do Telegram
const TELEGRAM_TOKEN = '9179415153:AAGUvi8GmakFwjrxT_3BM2IoqqYkIssGTag';
const CHAT_ID = '1633419568';

// Função para enviar mensagens para o Telegram usando fetch nativo
async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: text,
                parse_mode: 'Markdown'
            })
        });
        const data = await response.json();
        if (!data.ok) {
            console.log('Erro ao enviar mensagem para o Telegram:', data);
        }
    } catch (error) {
        console.error('Erro de conexão com o Telegram:', error);
    }
}

// Rota de teste/status para manter o servidor ativo no Render
app.get('/', (req, res) => {
    res.send('Servidor de Alertas MaxIncome a funcionar 24/7!');
});

// Endpoint para receber e disparar os sinais de Compra/Venda
app.post('/webhook', async (req, res) => {
    const { acao, par, preco, horario } = req.body;
    
    if (!acao) {
        return res.status(400).json({ status: 'erro', mensagem: 'Ação não informada' });
    }

    let mensagem = `🚨 *SINAL DE TRADING* 🚨\n\n`;
    mensagem += `📊 *Ação:* ${acao}\n`;
    if (par) mensagem += `💱 *Ativo:* ${par}\n`;
    if (preco) mensagem += `💰 *Preço:* ${preco}\n`;
    if (horario) mensagem += `⏰ *Horário:* ${horario}\n`;

    await sendTelegramMessage(mensagem);

    res.status(200).json({ status: 'sucesso', mensagem: 'Alerta enviado para o Telegram!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor a rodar na porta ${PORT}`);
});
