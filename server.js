// =============================================================
// MaxIncome - Nuvem Autônoma 24/7 (Versão Híbrida: Venda + Nova Compra)
// =============================================================

const CONFIG = {
  // Ativo principal que está sendo monitorado para venda das sobras
  SYMBOL_ANTIGO: 'XRPUSDT',
  
  // Novo ativo dinâmico para novas compras com o saldo livre em USDT (ex: SOLUSDT ou BTCUSDT)
  SYMBOL_NOVO: 'SOLUSDT', 
  
  // Percentual do saldo livre em USDT a utilizar na nova compra
  ORDER_USAGE_PERCENT: 0.50, // Utiliza 50% do USDT disponível
  
  // Percentual de Lucro Alvo para disparo automático de Venda
  TARGET_PROFIT_PERCENT: 0.02, // 2% de lucro
  
  CHECK_INTERVAL_MS: 15000 // A cada 15 segundos
};

/**
 * Função Principal de Ciclo Híbrido (Mantém a venda anterior + Adiciona novas compras)
 */
async function rodarCicloHibrido() {
  console.log(`[${new Date().toLocaleTimeString()}] 🚀 Robô MaxIncome em Execução Híbrida Ativa!`);
  
  setInterval(async () => {
    try {
      // 1. Obter Saldo e Cotações
      const saldo = await buscarSaldoBybit(); 
      const precoAtualAntigo = await buscarPrecoAtual(CONFIG.SYMBOL_ANTIGO);
      const precoAtualNovo = await buscarPrecoAtual(CONFIG.SYMBOL_NOVO);

      // ==========================================
      // FUNÇÃO 1: Continuar procurando venda do ativo antigo (XRP)
      // ==========================================
      if (saldo.XRP > 0) {
        const precoAlvoVendaAntigo = saldo.PRECO_MEDIO_XRP * (1 + CONFIG.TARGET_PROFIT_PERCENT);
        console.log(`🔍 [XRP] Monitorando venda: Alvo $${precoAlvoVendaAntigo.toFixed(4)} | Atual: $${precoAtualAntigo.toFixed(4)}`);

        if (precoAtualAntigo >= precoAlvoVendaAntigo) {
          console.log(`🚀 Alvo atingido para XRP! Executando VENDA...`);
          await executarOrdemBybit('SELL', CONFIG.SYMBOL_ANTIGO, saldo.XRP);
        }
      }

      // ==========================================
      // FUNÇÃO 2 (NOVA): Usar USDT livre para comprar o novo ativo de maior valorização
      // ==========================================
      if (saldo.USDT >= 10 && saldo.NOVO_ATIVO_QTD === 0) {
        const valorParaComprar = saldo.USDT * CONFIG.ORDER_USAGE_PERCENT;
        const qtdParaComprar = (valorParaComprar / precoAtualNovo).toFixed(3);

        console.log(`🎯 [NOVA FUNÇÃO] Usando USDT livre para comprar ${CONFIG.SYMBOL_NOVO}...`);
        const ordemNova = await executarOrdemBybit('BUY', CONFIG.SYMBOL_NOVO, qtdParaComprar);

        if (ordemNova.sucesso) {
          console.log(`✅ Nova compra executada em ${CONFIG.SYMBOL_NOVO} com sucesso!`);
        }
      }

      // ==========================================
      // FUNÇÃO 3 (NOVA): Monitorar e vender o novo ativo quando atingir o lucro
      // ==========================================
      if (saldo.NOVO_ATIVO_QTD > 0) {
        const precoAlvoNovo = saldo.PRECO_MEDIO_NOVO * (1 + CONFIG.TARGET_PROFIT_PERCENT);
        console.log(`🔍 [${CONFIG.SYMBOL_NOVO}] Monitorando alvo: $${precoAlvoNovo.toFixed(4)} | Atual: $${precoAtualNovo.toFixed(4)}`);

        if (precoAtualNovo >= precoAlvoNovo) {
          console.log(`🚀 Alvo atingido em ${CONFIG.SYMBOL_NOVO}! Executando VENDA e voltando para USDT...`);
          await executarOrdemBybit('SELL', CONFIG.SYMBOL_NOVO, saldo.NOVO_ATIVO_QTD);
        }
      }

    } catch (error) {
      console.error("❌ Erro no ciclo híbrido:", error.message);
    }
  }, CONFIG.CHECK_INTERVAL_MS);
}

// Iniciar sistema
rodarCicloHibrido();
