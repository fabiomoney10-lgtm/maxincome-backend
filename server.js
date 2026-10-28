<script>
    // Função para atualizar os dados automaticamente a cada 5 segundos
    async function autoRefreshData() {
        try {
            // Pega o par selecionado atualmente no dropdown
            const symbolSelect = document.getElementById('symbolSelect') || { value: 'BTCUSDT' };
            const symbol = symbolSelect.value || 'BTCUSDT';

            // Busca o status atualizado do servidor na nuvem
            const response = await fetch(`/grid-status?symbol=${symbol}`);
            const data = await response.json();

            if (data.success) {
                // Atualiza a cotação no painel visualmente em tempo real
                const priceElement = document.querySelector('.cotação-atual'); // ajuste conforme a classe do seu HTML
                if (priceElement) {
                    priceElement.innerText = `$ ${data.currentPrice}`;
                }
                console.log("Painel atualizado automaticamente com o preço:", data.currentPrice);
            }
        } catch (err) {
            console.error("Erro na atualização automática:", err);
        }
    }

    // Configura o temporizador para rodar a cada 5 segundos de forma totalmente autónoma
    setInterval(autoRefreshData, 5000);
</script>
