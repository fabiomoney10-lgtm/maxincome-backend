<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <title>MaxIncome - Pro Nuvem 24/7</title>
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <style>
        body { background-color: #131722; color: #d1d4dc; font-family: Arial, sans-serif; text-align: center; margin: 0; padding: 20px; }
        h1 { color: #f0b90b; }
        .card { background: #1e222d; padding: 20px; margin: 15px auto; width: 60%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        select, button { padding: 10px; font-size: 16px; border-radius: 5px; border: none; background: #f0b90b; color: #000; font-weight: bold; cursor: pointer; }
        .status-box { color: #0ecb81; font-weight: bold; margin-bottom: 20px; }
    </style>
</head>
<body>

    <h1>MaxIncome - Pro Nuvem 24/7</h1>
    <p>Plataforma Autónoma de Grid Trading & Rendimento Passivo</p>

    <div class="card">
        <select id="symbolSelect" onchange="atualizarDados()">
            <option value="BTCUSDT">Bitcoin (BTC/USDT)</option>
            <option value="ETHUSDT">Ethereum (ETH/USDT)</option>
            <option value="SOLUSDT">Solana (SOL/USDT)</option>
        </select>
        <button onclick="atualizarDados()">Atualizar Tudo</button>
    </div>

    <div class="status-box">🟢 Conectado ao Motor em Nuvem 24/7 com Sucesso!</div>

    <div class="card">
        <h3>Saldo USDT</h3>
        <h2 id="saldoUsdt" style="color: #0ecb81;">$ 8.99</h2>
    </div>

    <div class="card">
        <h3>Cotação Atual</h3>
        <h2 id="currentPrice" style="color: #f0b90b;">$ --</h2>
    </div>

    <script>
        async function atualizarDados() {
            const symbol = document.getElementById('symbolSelect').value;
            try {
                // Busca o preço real na Bybit via backend em tempo real
                const res = await fetch(`/grid-status?symbol=${symbol}`);
                const data = await res.json();
                if (data.success) {
                    document.getElementById('currentPrice').innerText = `$ ${data.currentPrice}`;
                }

                // Busca o saldo real da conta unificada
                const accRes = await fetch('/binance-account');
                const accData = await accRes.json();
                if (accData.success && accData.balances) {
                    document.getElementById('saldoUsdt').innerText = `$ ${accData.balances[0].free}`;
                }
            } catch (e) {
                console.error("Erro ao atualizar:", e);
            }
        }

        // Atualiza automaticamente em tempo real a cada 3 segundos de forma autónoma
        setInterval(atualizarDados, 3000);
        window.onload = atualizarDados;
    </script>

</body>
</html>
