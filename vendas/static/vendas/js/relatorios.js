// vendas/static/vendas/js/relatorios.js

// Reutiliza a função getCookie de pdv.js
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

document.addEventListener('DOMContentLoaded', function() {
    // --- Constantes dos Elementos do DOM - Resumo de Vendas ---
    const resumoStartDateInput = document.getElementById('resumo-start-date');
    const resumoEndDateInput = document.getElementById('resumo-end-date');
    const resumoFormaPagamentoSelect = document.getElementById('resumo-forma-pagamento');
    const resumoFilterButton = document.getElementById('resumo-filter-button');
    const resumoTotalVendasSpan = document.getElementById('resumo-total-vendas');
    const resumoTotalDescontosSpan = document.getElementById('resumo-total-descontos');
    const resumoTotalItensSpan = document.getElementById('resumo-total-itens');
    const resumoTotalTransacoesSpan = document.getElementById('resumo-total-transacoes');
    const resumoFormasPagamentoBody = document.getElementById('resumo-formas-pagamento-body');
    const vendasFormaPagamentoChartCanvas = document.getElementById('vendas-forma-pagamento-chart'); // NOVO
    let vendasFormaPagamentoChart = null; // NOVO: Objeto Chart.js para vendas por forma de pagamento

    // --- Constantes dos Elementos do DOM - Produtos Mais Vendidos ---
    const maisVendidosStartDateInput = document.getElementById('mais-vendidos-start-date');
    const maisVendidosEndDateInput = document.getElementById('mais-vendidos-end-date');
    const maisVendidosLimitInput = document.getElementById('mais-vendidos-limit');
    const maisVendidosFilterButton = document.getElementById('mais-vendidos-filter-button');
    const maisVendidosBody = document.getElementById('mais-vendidos-body');
    const produtosMaisVendidosChartCanvas = document.getElementById('produtos-mais-vendidos-chart'); // NOVO
    let produtosMaisVendidosChart = null; // NOVO: Objeto Chart.js para produtos mais vendidos

    // --- Constantes dos Elementos do DOM - Estoque Baixo/Crítico ---
    const estoqueBaixoRefreshButton = document.getElementById('estoque-baixo-refresh-button');
    const estoqueBaixoBody = document.getElementById('estoque-baixo-body');


    // --- Funções para Carregar Dados dos Relatórios ---

    // Carrega o resumo de vendas
    async function loadResumoVendas() {
        resumoFormasPagamentoBody.innerHTML = '<tr><td colspan="3" class="text-center">Carregando...</td></tr>';

        const startDate = resumoStartDateInput.value;
        const endDate = resumoEndDateInput.value;
        const formaPagamento = resumoFormaPagamentoSelect.value;

        const url = `${DJANGO_URLS.resumoVendas}?start_date=${startDate}&end_date=${endDate}&forma_pagamento=${formaPagamento}`;

        try {
            const response = await fetch(url);
            const responseData = await response.json();

            if (response.ok) {
                resumoTotalVendasSpan.textContent = `R$ ${parseFloat(responseData.total_vendas_liquido).toFixed(2).replace('.', ',')}`;
                resumoTotalDescontosSpan.textContent = `R$ ${parseFloat(responseData.total_descontos).toFixed(2).replace('.', ',')}`;
                resumoTotalItensSpan.textContent = responseData.total_itens_vendidos;
                resumoTotalTransacoesSpan.textContent = responseData.total_transacoes;

                resumoFormasPagamentoBody.innerHTML = '';
                if (responseData.detalhes_por_forma_pagamento.length === 0) {
                    resumoFormasPagamentoBody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhum dado para o período.</td></tr>';
                } else {
                    responseData.detalhes_por_forma_pagamento.forEach(item => {
                        const row = resumoFormasPagamentoBody.insertRow();
                        row.innerHTML = `
                            <td>${item.forma_pagamento}</td>
                            <td>R$ ${parseFloat(item.total_liquido).toFixed(2).replace('.', ',')}</td>
                            <td>${item.num_transacoes}</td>
                        `;
                    });
                }
                // NOVO: Atualizar/Criar o gráfico de vendas por forma de pagamento
                updateVendasFormaPagamentoChart(responseData.detalhes_por_forma_pagamento);

            } else {
                console.error('Erro ao carregar resumo de vendas:', responseData.error);
                resumoFormasPagamentoBody.innerHTML = `<tr><td colspan="3" class="text-center">Erro: ${responseData.error || 'Verifique o console.'}</td></tr>`;
            }
        } catch (error) {
            console.error('Erro de conexão ao carregar resumo de vendas:', error);
            resumoFormasPagamentoBody.innerHTML = `<tr><td colspan="3" class="text-center">Erro de conexão.</td></tr>`;
        }
    }

    // NOVO: Função para atualizar/criar o gráfico de vendas por forma de pagamento
    function updateVendasFormaPagamentoChart(data) {
        if (vendasFormaPagamentoChart) {
            vendasFormaPagamentoChart.destroy(); // Destrói o gráfico anterior
        }

        const labels = data.map(item => item.forma_pagamento);
        const totals = data.map(item => parseFloat(item.total_liquido));

        vendasFormaPagamentoChart = new Chart(vendasFormaPagamentoChartCanvas, {
            type: 'bar', // Pode ser 'pie' ou 'doughnut' também
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Líquido (R$)',
                    data: totals,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)', // Vermelho
                        'rgba(54, 162, 235, 0.6)', // Azul
                        'rgba(255, 206, 86, 0.6)', // Amarelo
                        'rgba(75, 192, 192, 0.6)', // Verde
                        'rgba(153, 102, 255, 0.6)', // Roxo
                        'rgba(255, 159, 64, 0.6)'  // Laranja
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Permite controlar o tamanho via CSS
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Total Líquido (R$)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Forma de Pagamento'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Total de Vendas por Forma de Pagamento'
                    }
                }
            }
        });
    }

    // Carrega os produtos mais vendidos
    async function loadProdutosMaisVendidos() {
        maisVendidosBody.innerHTML = '<tr><td colspan="4" class="text-center">Carregando...</td></tr>';

        const startDate = maisVendidosStartDateInput.value;
        const endDate = maisVendidosEndDateInput.value;
        const limit = maisVendidosLimitInput.value;

        const url = `${DJANGO_URLS.produtosMaisVendidos}?start_date=${startDate}&end_date=${endDate}&limit=${limit}`;

        try {
            const response = await fetch(url);
            const responseData = await response.json();

            if (response.ok) {
                maisVendidosBody.innerHTML = '';
                if (responseData.produtos_mais_vendidos.length === 0) {
                    maisVendidosBody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum produto encontrado.</td></tr>';
                } else {
                    responseData.produtos_mais_vendidos.forEach(item => {
                        const row = maisVendidosBody.insertRow();
                        row.innerHTML = `
                            <td>${item.produto__nome}</td>
                            <td>${item.produto__codigo_barras}</td>
                            <td>${parseFloat(item.total_quantidade_vendida).toFixed(3).replace('.', ',')} ${item.produto__unidade_medida}</td>
                            <td>R$ ${parseFloat(item.total_valor_vendido).toFixed(2).replace('.', ',')}</td>
                        `;
                    });
                }
                // NOVO: Atualizar/Criar o gráfico de produtos mais vendidos
                updateProdutosMaisVendidosChart(responseData.produtos_mais_vendidos);

            } else {
                console.error('Erro ao carregar produtos mais vendidos:', responseData.error);
                maisVendidosBody.innerHTML = `<tr><td colspan="4" class="text-center">Erro: ${responseData.error || 'Verifique o console.'}</td></tr>`;
            }
        } catch (error) {
            console.error('Erro de conexão ao carregar produtos mais vendidos:', error);
            maisVendidosBody.innerHTML = `<tr><td colspan="4" class="text-center">Erro de conexão.</td></tr>`;
        }
    }

    // NOVO: Função para atualizar/criar o gráfico de produtos mais vendidos
    function updateProdutosMaisVendidosChart(data) {
        if (produtosMaisVendidosChart) {
            produtosMaisVendidosChart.destroy();
        }

        const labels = data.map(item => item.produto__nome);
        const quantities = data.map(item => parseFloat(item.total_quantidade_vendida));

        produtosMaisVendidosChart = new Chart(produtosMaisVendidosChartCanvas, {
            type: 'doughnut', // Ou 'pie', 'bar'
            data: {
                labels: labels,
                datasets: [{
                    label: 'Quantidade Vendida',
                    data: quantities,
                    backgroundColor: [
                        '#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#17a2b8', '#fd7e14', '#e83e8c', '#6c757d', '#20c997'
                    ],
                    borderColor: '#fff',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    title: {
                        display: true,
                        text: 'Top Produtos Mais Vendidos'
                    }
                }
            }
        });
    }

    // Carrega a lista de produtos com estoque baixo/crítico
    async function loadEstoqueBaixo() {
        estoqueBaixoBody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando...</td></tr>';

        try {
            const response = await fetch(DJANGO_URLS.estoqueBaixo);
            const responseData = await response.json();

            if (response.ok && responseData.produtos_baixo_estoque) {
                estoqueBaixoBody.innerHTML = '';
                if (responseData.produtos_baixo_estoque.length === 0) {
                    estoqueBaixoBody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum produto com estoque baixo.</td></tr>';
                } else {
                    responseData.produtos_baixo_estoque.forEach(produto => {
                        const row = estoqueBaixoBody.insertRow();
                        const statusClass = produto.status_estoque === 'CRÍTICO' ? 'status-critico' : 'status-normal'; // Reutiliza classes de estoque.css
                        row.innerHTML = `
                            <td>${produto.nome}</td>
                            <td>${produto.codigo_barras}</td>
                            <td>${parseFloat(produto.estoque).toFixed(3).replace('.', ',')}</td>
                            <td>${parseFloat(produto.estoque_minimo).toFixed(3).replace('.', ',')}</td>
                            <td>${produto.unidade_medida}</td>
                            <td class="${statusClass}">${produto.status_estoque}</td>
                        `;
                    });
                }
            } else {
                console.error('Erro ao carregar estoque baixo:', responseData.error);
                estoqueBaixoBody.innerHTML = `<tr><td colspan="6" class="text-center">Erro: ${responseData.error || 'Verifique o console.'}</td></tr>`;
            }
        } catch (error) {
            console.error('Erro de conexão ao carregar estoque baixo:', error);
            estoqueBaixoBody.innerHTML = `<tr><td colspan="6" class="text-center">Erro de conexão.</td></tr>`;
        }
    }


    // --- Inicialização e Event Listeners ---

    // Define as datas padrão para os filtros (ex: último mês)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const formatDate = (date) => date.toISOString().split('T')[0];

    resumoStartDateInput.value = formatDate(thirtyDaysAgo);
    resumoEndDateInput.value = formatDate(today);
    maisVendidosStartDateInput.value = formatDate(thirtyDaysAgo);
    maisVendidosEndDateInput.value = formatDate(today);


    // Carregar todos os relatórios ao carregar a página
    loadResumoVendas();
    loadProdutosMaisVendidos();
    loadEstoqueBaixo();

    // Event Listeners para os botões de filtro/atualização
    resumoFilterButton.addEventListener('click', loadResumoVendas);
    maisVendidosFilterButton.addEventListener('click', loadProdutosMaisVendidos);
    estoqueBaixoRefreshButton.addEventListener('click', loadEstoqueBaixo);

    // Opcional: Recarregar resumo/mais vendidos ao mudar as datas/filtros
    resumoStartDateInput.addEventListener('change', loadResumoVendas);
    resumoEndDateInput.addEventListener('change', loadResumoVendas);
    resumoFormaPagamentoSelect.addEventListener('change', loadResumoVendas);
    maisVendidosStartDateInput.addEventListener('change', loadProdutosMaisVendidos);
    maisVendidosEndDateInput.addEventListener('change', loadProdutosMaisVendidos);
    maisVendidosLimitInput.addEventListener('change', loadProdutosMaisVendidos);

});