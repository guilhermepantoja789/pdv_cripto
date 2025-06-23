// estoque/static/estoque/js/estoque.js

// Função para obter o CSRF token do cookie (reutilizada)
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
    // --- Constantes dos Elementos do DOM ---
    const searchInput = document.getElementById('search-input');
    const statusFilterSelect = document.getElementById('status-filter-select');
    const btnRefreshStock = document.getElementById('btn-refresh-stock');
    const estoqueTableBody = document.getElementById('estoque-table-body');

    // Constantes do Modal de Ajuste de Estoque
    const stockAdjustmentModal = document.getElementById('stock-adjustment-modal');
    const adjustmentProductName = document.getElementById('adjustment-product-name');
    const adjustmentProductInfo = document.getElementById('adjustment-product-info');
    const adjustmentCurrentStock = document.getElementById('adjustment-current-stock');
    const adjustmentTypeSelect = document.getElementById('adjustment-type');
    const adjustmentQuantityInput = document.getElementById('adjustment-quantity');
    const adjustmentObservationTextarea = document.getElementById('adjustment-observation');
    const adjustmentMessage = document.getElementById('adjustment-message');
    const adjustmentConfirmButton = document.getElementById('adjustment-confirm-button');
    const adjustmentCancelButton = document.getElementById('adjustment-cancel-button');
    const adjustmentCloseButton = stockAdjustmentModal.querySelector('.close-button');

    let currentProductForAdjustment = null; // Armazena o produto selecionado para ajuste
    let loadedProducts = []; // NOVO: Armazena os produtos carregados pela loadEstoque()
    // --- Funções Auxiliares ---

    // Carrega e exibe a lista de produtos em estoque
    async function loadEstoque() {
        estoqueTableBody.innerHTML = '<tr><td colspan="9" class="text-center">Carregando produtos...</td></tr>';

        const searchQuery = searchInput.value;
        const statusFilter = statusFilterSelect.value;

        const url = `${DJANGO_URLS.estoqueListar}?q=${searchQuery}&status=${statusFilter}`;

        try {
            const response = await fetch(url);
            const responseData = await response.json();

            if (response.ok && responseData.produtos) {
                 loadedProducts = responseData.produtos; // <<< ARMAZENA OS PRODUTOS AQUI!
                 estoqueTableBody.innerHTML = '';
                 if (loadedProducts.length === 0) {
                     estoqueTableBody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhum produto encontrado.</td></tr>';
                     return;
                 }

                 loadedProducts.forEach(produto => { // Itera sobre loadedProducts
                     const row = estoqueTableBody.insertRow();
                     const statusClass = produto.status_estoque === 'baixo' ? 'status-baixo' : 'status-normal';

                     row.innerHTML = `
                         <td>${produto.codigo_barras}</td>
                         <td>${produto.nome}</td>
                         <td>R$ ${parseFloat(produto.preco_venda).toFixed(2).replace('.', ',')}</td>
                         <td>${parseFloat(produto.estoque).toFixed(3).replace('.', ',')}</td>
                         <td>${parseFloat(produto.estoque_minimo).toFixed(3).replace('.', ',')}</td>
                         <td>${produto.unidade_medida}</td>
                         <td>${produto.ativo ? 'Sim' : 'Não'}</td>
                         <td class="${statusClass}">${produto.status_estoque.toUpperCase()}</td>
                         <td class="action-column">
                             <button class="adjust-stock-btn" data-product-id="${produto.id}">Ajustar</button>
                         </td>
                     `;
                 });
            } else {
                console.error('Erro ao carregar estoque:', responseData.error);
                estoqueTableBody.innerHTML = `<tr><td colspan="9" class="text-center">Erro ao carregar estoque: ${responseData.error || 'Verifique o console.'}</td></tr>`;
            }

        } catch (error) {
            console.error('Erro de conexão ao carregar estoque:', error);
            estoqueTableBody.innerHTML = '<tr><td colspan="9" class="text-center">Erro de conexão ao carregar estoque.</td></tr>';
        }
    }

    // Abre o modal de ajuste de estoque
     async function openAdjustmentModal(productId) { // Não precisa mais ser async
         // --- CORREÇÃO AQUI: Busca o produto no array carregado ---
         const produto = loadedProducts.find(p => p.id == productId); // Use == para comparar number com string
         if (!produto) {
             alert('Produto não encontrado para ajuste.');
             return;
         }
         currentProductForAdjustment = produto; // Armazena o produto completo

         adjustmentProductName.textContent = produto.nome;
         adjustmentProductInfo.textContent = `Código: ${produto.codigo_barras} | Unid: ${produto.unidade_medida}`;
         adjustmentCurrentStock.textContent = parseFloat(produto.estoque).toFixed(3).replace('.', ',');

         adjustmentTypeSelect.value = 'ENTRADA';
         adjustmentQuantityInput.value = '1.000';
         adjustmentObservationTextarea.value = '';
         adjustmentMessage.textContent = '';
         adjustmentMessage.classList.remove('error', 'success'); // Limpa estilos de mensagem

         stockAdjustmentModal.style.display = 'flex';
         adjustmentQuantityInput.focus();
     }

    // Envia o ajuste de estoque para o backend
    async function sendAdjustment() {
        if (!currentProductForAdjustment) return;

        adjustmentMessage.textContent = '';
        adjustmentMessage.classList.remove('error', 'success'); // Limpa estilos de mensagem

        const tipoMovimento = adjustmentTypeSelect.value;
        const quantidade = parseFloat(adjustmentQuantityInput.value.replace(',', '.'));
        const observacao = adjustmentObservationTextarea.value.trim();

        if (isNaN(quantidade) || quantidade <= 0) {
            adjustmentMessage.textContent = 'Quantidade inválida. Deve ser maior que 0.';
            adjustmentMessage.classList.add('error');
            return;
        }

        try {
            const response = await fetch(DJANGO_URLS.estoqueAjustar, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({
                    produto_id: currentProductForAdjustment.id,
                    tipo_movimento: tipoMovimento,
                    quantidade: quantidade,
                    observacao: observacao
                })
            });
            const responseData = await response.json();

            if (response.ok) {
                adjustmentMessage.textContent = responseData.message;
                adjustmentMessage.classList.add('success');
                // Não usa alert. Mantém o modal aberto brevemente para mostrar sucesso.
                // alert(responseData.message);

                // Fecha o modal após um curto delay para o usuário ver a mensagem de sucesso
                setTimeout(() => {
                    stockAdjustmentModal.style.display = 'none';
                    currentProductForAdjustment = null; // Limpa o produto do modal
                    loadEstoque(); // Recarrega a lista de estoque para ver a atualização
                }, 1500); // Fecha após 1.5 segundos


            } else {
                adjustmentMessage.textContent = responseData.error || 'Erro ao ajustar estoque.';
                adjustmentMessage.classList.add('error');
            }
        } catch (error) {
            console.error('Erro de conexão ao enviar ajuste:', error);
            adjustmentMessage.textContent = 'Erro de conexão.';
            adjustmentMessage.classList.add('error');
        }
    }

    // Fecha o modal de ajuste de estoque
    function closeAdjustmentModal() {
        stockAdjustmentModal.style.display = 'none';
        currentProductForAdjustment = null;
    }

    // --- Event Listeners ---

    // Carregar estoque ao iniciar a página
    loadEstoque();

    // Event listeners para filtros e busca
    btnRefreshStock.addEventListener('click', loadEstoque);
    searchInput.addEventListener('input', loadEstoque); // Busca em tempo real
    statusFilterSelect.addEventListener('change', loadEstoque);

    // Event listener para os botões "Ajustar" na tabela
    estoqueTableBody.addEventListener('click', function(event) {
        if (event.target.classList.contains('adjust-stock-btn')) {
            const productId = event.target.dataset.productId;
            openAdjustmentModal(productId);
        }
    });

    // Event listeners para o modal de ajuste
     adjustmentConfirmButton.addEventListener('click', sendAdjustment);
     adjustmentCancelButton.addEventListener('click', closeAdjustmentModal);
     adjustmentCloseButton.addEventListener('click', closeAdjustmentModal); // Para o botão 'x'

     // Permitir Enter para confirmar no input de quantidade do modal de ajuste
     adjustmentQuantityInput.addEventListener('keydown', function(event) {
         if (event.key === 'Enter') {
             sendAdjustment();
             event.preventDefault();
         }
     });

     // Permitir Enter no botão de Confirmação do modal de ajuste
     adjustmentConfirmButton.addEventListener('keydown', function(event) {
         if (event.key === 'Enter') {
             sendAdjustment();
             event.preventDefault();
         }
     });

     // Permitir Esc para cancelar no modal de ajuste
     stockAdjustmentModal.addEventListener('keydown', function(event) {
         if (event.key === 'Escape') {
             closeAdjustmentModal();
             event.preventDefault();
             event.stopPropagation(); // Impede propagação para a tela principal
         }
     });
});