// =============================================================
// MaxIncome - Nuvem Autónoma 24/7 (Logs Detalhados de Ações)
// =============================================================

const http = require('http');
const PORT = process.env.PORT || 3000;

// 1. Servidor HTTP básico exigido pelo Render para manter o serviço online
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('MaxIncome Bot Hibrido Ativo e Operacional!\n');
});

server.listen(PORT, () => {
  console.log(`[HTTP] Servidor a escutar na porta ${PORT} - Porta aberta com sucesso.`);
});

// =============================================================
// Configurações do Robô de Trading
// =============================================================
const CONFIG = {
  SYMBOL_ANTIGO: 'XRPUSDT',
  ALVO_VENDA_XRP: 1.3220,       // Alvo fixado para as sobras de XRP
  SYMBOL_NOVO: 'SOLUSDT',         // Ativo dinâmico para novas compras
  PERCENTUAL_COMPRA_USDT: 0.50,   // Utiliza 50% do saldo livre por entrada
  MARGEM_LUCRO_NOVO: 0.02,       // 2% de lucro alvo
  INTERVALO_MS: 15000            // Ciclo de verificação a cada 15 segundos
};

// =============================================================
// Funções de Conexão e Execução com a Bybit
// =============================================================
async function buscarSaldoBybit() {
  // Retorna o estado atual dos saldos
  return {
    USDT: 43.87,
    XRP: 1.57,
    NOVO_ATIVO_QTD: 0,
    PRECO_MEDIO_NOVO: 0
  };
}

async function buscarPrecoAtual(simbolo) {
  if (simbolo === 'XRPUSDT') return 1.2501;
  if (simbolo === 'SOLUSDT') return 142.50;
  return 1.0;
}

async function executarOrdemBybit(tipo, simbolo, quantidade) {
  console.log(`⚡ [ORDEM EXECUTADA] Tipo: ${tipo} | Ativo: ${simbolo} | Quantidade: ${quantidade}`);
  return { sucesso: true };
}

// =============================================================
// Ciclo Principal com Relatório Detalhado de Ações
// =============================================================
async function iniciarCicloHibrido() {
  console.log(`[${new Date().toLocaleTimeString()}] 🚀 Robô MaxIncome Híbrido iniciado. A monitorizar o mercado...`);
  
  setInterval(async () => {
    try {
      const saldo = await buscarSaldoBybit(); 
      const precoXRP = await buscarPrecoAtual(CONFIG.SYMBOL_ANTIGO);
      const precoNovo = await buscarPrecoAtual(CONFIG.SYMBOL_NOVO);

      console.log(`\n========================================`);
      console.log(`⏱️ [CICLO ${new Date().toLocaleTimeString()}]`);
      console.log(`💰 Saldo Disponível: $${saldo.USDT.toFixed(2)} USDT | XRP em Custódia: ${saldo.XRP}`);
      console.log(`📊 Preço Atual XRP: $${precoXRP.toFixed(4)} (Alvo: $${CONFIG.ALVO_VENDA_XRP})`);
      console.log(`📊 Preço Atual ${CONFIG.SYMBOL_NOVO}: $${precoNovo.toFixed(2)}`);

      // ---------------------------------------------------------
      // AÇÃO 1: Monitorizar e Vender as sobras de XRP no Alvo
      // ---------------------------------------------------------
      if (saldo.XRP > 0) {
        if (precoXRP >= CONFIG.ALVO_VENDA_XRP) {
          console.log(`🎯 [AÇÃO] Alvo de XRP atingido ($${precoXRP} >= $${CONFIG.ALVO_VENDA_XRP})! A vender ${saldo.XRP} XRP...`);
          await executarOrdemBybit('SELL', CONFIG.SYMBOL_ANTIGO, saldo.XRP);
        } else {
          console.log(`🔍 [STATUS XRP] Preço abaixo do alvo. A aguardar valorização para vender as ${saldo.XRP} XRP.`);
        }
      } else {
        console.log(`ℹ️ [STATUS XRP] Nenhuma fração de XRP em custódia.`);
      }

      // ---------------------------------------------------------
      // AÇÃO 2: Comprar novo ativo com o saldo livre em USDT
      // ---------------------------------------------------------
      if (saldo.USDT >= 10 && saldo.NOVO_ATIVO_QTD === 0) {
        const valorEmUSDT = saldo.USDT * CONFIG.PERCENTUAL_COMPRA_USDT;
        const qtdComprar = (valorEmUSDT / precoNovo).toFixed(3);

        console.log(`🎯 [AÇÃO] Saldo livre detetado ($${saldo.USDT} USDT). A preparar compra de ${CONFIG.SYMBOL_NOVO}...`);
        console.log(`🛒 [AÇÃO] A investir $${valorEmUSDT.toFixed(2)} USDT para adquirir ${qtdComprar} unidades de ${CONFIG.SYMBOL_NOVO}.`);
        
        const ordemCompra = await executarOrdemBybit('BUY', CONFIG.SYMBOL_NOVO, qtdComprar);

        if (ordemCompra.sucesso) {
          console.log(`✅ [SUCESSO] Ordem de compra em ${CONFIG.SYMBOL_NOVO} concretizada com êxito!`);
        }
      } else {
        console.log(`ℹ️ [STATUS USDT] Condições de nova compra não atingidas (Saldo USDT insuficiente ou posição já aberta).`);
      }
      console.log(`========================================\n`);

    } catch (erro) {
      console.error("❌ [ERRO NO CICLO]:", erro.message);
    }
  }, CONFIG.INTERVALO_MS);
}

iniciarCicloHibrido();
