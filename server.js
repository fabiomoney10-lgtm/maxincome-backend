// --- LISTA DE ATIVOS A MONITORIZAR ---
const ATIVOS_MONITORADOS = ['XRP/USDT', 'BTC/USDT', 'ETH/USDT', 'SOL/USDT'];

function iniciarMonitorizacaoNuvem() {
    console.log("Motor de monitorização autónoma 24/7 iniciado na nuvem.");
    
    setInterval(() => {
        const agora = new Date();
        const minutos = agora.getMinutes();
        const segundos = agora.getSeconds();

        // Verifica o fecho das velas de 5 minutos nos primeiros 10 segundos
        if (minutos % 5 === 0 && segundos <= 10) {
            console.log(`[Cloud Bot] Janela de análise atingida em ${agora.toLocaleTimeString()}`);
            
            // Percorre a lista de criptomoedas e dispara para cada uma
            ATIVOS_MONITORADOS.forEach((par) => {
                const mensagemAutonoma = `🤖 *Alerta Automático (24/7)*\n\n` +
                                         `• *Ativo:* ${par}\n` +
                                         `• *Ciclo:* Vela de 5M fechada\n` +
                                         `• *Status:* Sistema a operar 24/7 na nuvem!`;
                
                enviarMensagemTelegram(mensagemAutonoma);
            });
        }
    }, 10000);
}
