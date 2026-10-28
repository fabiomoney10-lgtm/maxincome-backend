<script>
    async function fetchGridStatus() {
        try {
            // Obtém o par selecionado no dropdown (ex: BTCUSDT, ETHUSDT, SOLUSDT)
            const selectElement = document.getElementById('symbolSelect') || document.querySelector('select');
            let symbolValue = 'BTCUSDT';
            
            if (selectElement) {
                const selectedText = selectElement.value;
                if (selectedText.includes('ETH')) symbolValue = 'ETHUSDT';
                else if (selectedText.includes('SOL')) symbolValue = 'SOLUSDT';
                else symbolValue = 'BTCUSDT';
            }

            // Faz a requisição ao nosso backend no Render
            const response = await fetch(`/grid-status?symbol=${symbolValue}`);
            const data = await response.json();

            if (data.success) {
                // Atualiza a Cotação Atual no ecrã em tempo real
                const priceBox = document.querySelector('.cotação-atual, #currentPrice, div:nth-child(2) > .cotação-atual');
                // Procura pelo elemento da cotação de forma segura
                const boxes = document.querySelectorAll('.cotação-atual, h2, .text-xl, div');
                
                // Atualiza o valor visualmente na página
                document.querySelectorAll('div').forEach(el => {
                    if (el.innerText && el.innerText.startsWith('$ 81138') || el.id === 'currentPrice') {
                        el.innerText = `$ ${data.currentPrice}`;
                    }
                });

                console.log(`Preço atualizado para ${data.symbol}: $`, data.currentPrice);
            }
        } catch (error) {
            console.error("Erro ao atualizar dados em tempo real:", error);
        }
    }

    // Executa a cada 5 segundos de forma totalmente autónoma
    setInterval(fetchGridStatus, 5000);

    // Também atualiza sempre que mudar a opção no menu dropdown
    const dropdown = document.getElementById('symbolSelect') || document.querySelector('select');
    if (dropdown) {
        dropdown.addEventListener('change', fetchGridStatus);
    }
</script>
