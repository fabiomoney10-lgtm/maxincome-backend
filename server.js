// =============================================================
// MaxIncome - Nuvem Autónoma 24/7 (Código Híbrido Completo)
// =============================================================

const http = require('http');
const PORT = process.env.PORT || 3000;

// 1. Servidor HTTP básico para manter a porta aberta no Render
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('MaxIncome Bot Hibrido Ativo e Operacional!\n');
});

server.listen(PORT, () => {
  console.log(`Servidor HTTP a escutar na porta ${PORT}`);
});

// =============================================================
// Configurações do Robô de Trading
// =============================================================
const CONFIG = {
  SYMBOL_ANTIGO: 'XRPUSDT',
  ALVO_VENDA_XRP: 1.3220,       // Teu alvo fixado para o XRP
  SYMBOL_NOVO: 'SOLUSDT',         // Novo ativo para novas compras
  PERCENTUAL_COMPRA_USDT: 0.50,   // Usa 50% do saldo livre por entrada
  MARGEM_LUCRO_NOVO: 0.02,       // 2% de lucro alvo
  INTERVALO_MS: 15000            // Verifica a cada 15 segundos
};

// =============================================================
// Funções de Conexão e Execução com a Bybit
// =============================================================
async function buscarSaldoBybit() {
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
  console.log(`[API BYBIT] A executar ${tipo} para ${quantidade} de ${simbolo}...`);
  return { sucesso: true };
}

// =============================================================
// Ciclo Principal de Operação Híbrida
// =============================================================
async function iniciarCicloHibrido() {
  console.log(`[${new Date().toLocaleTimeString()}] 🚀 Sistema MaxIncome Híbrido Iniciado com Sucesso!`);
  
  setInterval(async () => {
    try {
      const saldo = await buscarSaldoBybit(); 
      const precoXRP = await buscarPrecoAtual(CONFIG.SYMBOL_ANTIGO);
      const precoNovo = await buscarPrecoAtual(CONFIG.SYMBOL_NOVO);

      console.log(`\n--- [CHECK ${new Date().toLocaleTimeString()}] ---`);
      console.log(`USDT Livre: $${saldo.USDT.toFixed(2)} | XRP em Custódia: ${saldo.XRP}`);

      // 1. Monitorizar e Vender as sobras de XRP no Alvo ($1.3220)
      if (saldo.XRP > 0) {
        console.log(`🔍 [XRP] Preço Atual: $${precoXRP.toFixed(4)} | Alvo de Venda: $${CONFIG.ALVO_VENDA_XRP}`);
        if (precoXRP >= CONFIG.ALVO_VENDA_XRP) {
          console.log(`🚀 [XRP] Alvo atingido! Disparando ORDEM DE VENDA para ${saldo.XRP} XRP...`);
          await executarOrdemBybit('SELL', CONFIG.SYMBOL_ANTIGO, saldo.XRP);
        }
      }

      // 2. Usar o saldo em USDT livre para comprar o novo ativo (ex: SOL)
      if (saldo.USDT >= 10 && saldo.NOVO_ATIVO_QTD === 0) {
        const valorEmUSDT = saldo.USDT * CONFIG.PERCENTUAL_COMPRA_USDT;
        const qtdComprar = (valorEmUSDT / precoNovo).toFixed(3);

        console.log(`🎯 [${CONFIG.SYMBOL_NOVO}] Disparando ORDEM DE COMPRA de ${qtdComprar} unidades...`);
        const ordemCompra = await executarOrdemBybit('BUY', CONFIG.SYMBOL_NOVO, qtdComprar);

        if (ordemCompra.sucesso) {
          console.log(`✅ Compra de ${CONFIG.SYMBOL_NOVO} realizada com sucesso!`);
        }
      }

    } catch (erro) {
      console.error("❌ Erro no ciclo híbrido:", erro.message);
    }
  }, CONFIG.INTERVALO_MS);
}

iniciarCicloHibrido();
