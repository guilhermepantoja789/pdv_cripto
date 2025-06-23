// vendas/static/vendas/js/pdv.js

// Função para obter o CSRF token do cookie (essencial para requisições POST do Django)
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
    // --- Constantes e Variáveis de Estado (TODAS DECLARADAS NO INÍCIO PARA ACESSIBILIDADE) ---
    const barcodeInput = document.getElementById('barcode-input');
    const btnFinalizeSale = document.getElementById('btn-finalize-sale');
    const btnCancelSale = document.getElementById('btn-cancel-sale');
    const btnApplyDiscount = document.getElementById('btn-apply-discount');
    const btnNewSale = document.getElementById('btn-new-sale'); // Botão "Nova Venda"
    const productTableBody = document.querySelector('.product-table tbody');
    const paymentArea = document.querySelector('.pdv-payment-area'); // Área de seleção de pagamento principal
    const paymentOptionsButtons = document.querySelectorAll('.payment-button'); // Botões de forma de pagamento
    const subtotalSpan = document.getElementById('subtotal');
    const discountsSpan = document.getElementById('discounts');
    const finalTotalSpan = document.getElementById('final-total');
    const paymentDetailsDiv = document.getElementById('payment-details'); // Área para mensagens de pagamento

    // Constantes do Modal de Quantidade/Peso
    const quantityInputModal = document.getElementById('quantity-input-modal');
    const modalProductName = document.getElementById('modal-product-name');
    const modalQuantityInput = document.getElementById('modal-quantity-input');
    const modalUnitDisplay = document.getElementById('modal-unit-display');
    const modalConfirmButton = document.getElementById('modal-confirm-button');
    const modalCancelButton = document.getElementById('modal-cancel-button');
    const modalCloseButton = quantityInputModal.querySelector('.close-button');
    const modalErrorMessage = document.getElementById('modal-error-message');

    // Constantes do Modal de Pagamento PIX
    const pixPaymentModal = document.getElementById('pix-payment-modal');
    const modalPixTotal = document.getElementById('modal-pix-total');
    const modalQrcodeDisplay = document.getElementById('modal-qrcode-display');
    const modalPixCopyPasteCode = document.getElementById('modal-pix-copy-paste-code');
    const modalCopyPixButton = document.getElementById('modal-copy-pix-button');
    const modalPixTxid = document.getElementById('modal-pix-txid');
    const modalPixStatus = document.getElementById('modal-pix-status');
    const modalConfirmPixManually = document.getElementById('modal-confirm-pix-manually'); // Botão de confirmação manual (escondido)
    const modalCancelPix = document.getElementById('modal-cancel-pix');
    const pixCloseButton = pixPaymentModal.querySelector('.close-button');

    // Constantes do Modal de Pagamento Criptomoeda
    const cryptoPaymentModal = document.getElementById('crypto-payment-modal');
    const modalCryptoTotal = document.getElementById('modal-crypto-total');
    const modalCryptoCurrencyName = document.getElementById('modal-crypto-currency-name');
    const modalCryptoAmount = document.getElementById('modal-crypto-amount');
    const modalCryptoQrcodeDisplay = document.getElementById('modal-crypto-qrcode-display');
    const modalCryptoAddress = document.getElementById('modal-crypto-address');
    const modalCopyCryptoAddressButton = document.getElementById('modal-copy-crypto-address-button');
    const modalCryptoPaymentId = document.getElementById('modal-crypto-txid'); // ID no HTML é txid, JS usa payment_id
    const modalCryptoStatus = document.getElementById('modal-crypto-status');
    const modalConfirmCryptoManually = document.getElementById('modal-confirm-crypto-manually');
    const modalCancelCrypto = document.getElementById('modal-cancel-crypto');
    const cryptoCloseButton = cryptoPaymentModal.querySelector('.close-button');

    // Constantes dos novos elementos de seleção de Criptomoeda (dropdown e mínimo)
    const cryptoCurrencySelect = document.getElementById('crypto-currency-select');
    const modalCryptoMinBRL = document.getElementById('modal-crypto-min-brl');

    // --- Variáveis de Controle de Estado e Dados ---
    let saleItems = []; // Array para armazenar os itens da venda (o "carrinho")
    let pdvState = 'ADDING_PRODUCTS'; // Estado atual do PDV
    // Possíveis estados: 'ADDING_PRODUCTS', 'QUANTITY_INPUT_MODE', 'PAYMENT_MODE', 'PIX_MODAL_MODE', 'CRYPTO_MODAL_MODE', 'SALE_COMPLETED_MODE'

    let currentProductForModal = null; // Armazena o produto escaneado enquanto o modal está aberto

    let pixPollingInterval = null; // Para armazenar o ID do setInterval do polling do PIX
    let pixPollingStartTime = null;
    let cryptoPollingInterval = null; // Para o polling de criptomoeda
    let cryptoPollingStartTime = null;

    const PIX_POLLING_INTERVAL_MS = 5000; // Consultar a cada 5 segundos
    const PIX_POLLING_TIMEOUT_MS = 300000; // Tempo limite de 5 minutos (300 segundos * 1000 ms)

    let availableCryptos = []; // Variável para armazenar a lista de criptomoedas e seus detalhes
    const USD_TO_BRL_RATE = 5.00; // Cotação fixa USD para BRL (apenas para demonstração!)

    const btnGenerateCryptoPayment = document.getElementById('btn-generate-crypto-payment'); // Novo botão
    const cryptoPaymentDetailsSections = document.getElementById('crypto-payment-details-sections'); // Nova seção
    const cryptoSelectionErrorMessage = document.getElementById('crypto-selection-error-message'); // Nova mensagem de erro

    // Constantes dos elementos do Cabeçalho de Usuário/Caixa
    const loggedInUsernameSpan = document.getElementById('logged-in-username');
    const currentCashierStatusSpan = document.getElementById('current-cashier-status');
    const btnOpenCashier = document.getElementById('btn-open-cashier');
    const btnCloseCashier = document.getElementById('btn-close-cashier');
    const btnLogout = document.getElementById('btn-logout');

    // Constantes do Modal Abrir Caixa
    const openCashierModal = document.getElementById('open-cashier-modal');
    const openCashierUsername = document.getElementById('open-cashier-username');
    const openCashierInitialBalanceInput = document.getElementById('open-cashier-initial-balance');
    const openCashierMessage = document.getElementById('open-cashier-message');
    const openCashierConfirmButton = document.getElementById('open-cashier-confirm-button');
    const openCashierCancelButton = document.getElementById('open-cashier-cancel-button');
    const openCashierCloseButton = openCashierModal.querySelector('.close-button');

    // Constantes do Modal Fechar Caixa
    const closeCashierModal = document.getElementById('close-cashier-modal');
    const closeCashierUsername = document.getElementById('close-cashier-username');
    const closeCashierInitialBalanceDisplay = document.getElementById('close-cashier-initial-balance-display');
    const closeCashierSalesTotal = document.getElementById('close-cashier-sales-total');
    const closeCashierFinalBalanceInput = document.getElementById('close-cashier-final-balance');
    const closeCashierMessage = document.getElementById('close-cashier-message');
    const closeCashierConfirmButton = document.getElementById('close-cashier-confirm-button');
    const closeCashierCancelButton = document.getElementById('close-cashier-cancel-button');
    const closeCashierCloseButton = closeCashierModal.querySelector('.close-button');

    // Variável de controle para o ID do caixa aberto atualmente
    let currentOpenCashierId = null;

    // --- Funções Auxiliares (Todas definidas antes de serem chamadas no fluxo principal) ---

    async function checkLoginAndCashierStatus() {
        try {
            // CORREÇÃO: Usar nossa própria API para verificar o status do usuário
            const userStatusResponse = await fetch(DJANGO_URLS.loginStatus); // <<< NOVO ENDPOINT
            const userStatusData = await userStatusResponse.json();

            if (userStatusData.is_authenticated) {
                loggedInUsernameSpan.textContent = userStatusData.username;

                // Agora verifica o status do caixa para este usuário (mantém a lógica existente)
                const cashierResponse = await fetch(DJANGO_URLS.cashierStatus, { // <<< CORREÇÃO
                    headers: { 'X-CSRFToken': getCookie('csrftoken') }
                });
                const cashierData = await cashierResponse.json();

                if (cashierResponse.ok) {
                    if (cashierData.status === 'ABERTO') {
                        currentCashierStatusSpan.textContent = `Aberto (ID: ${cashierData.caixa_id})`;
                        currentCashierStatusSpan.style.color = 'green';
                        btnOpenCashier.style.display = 'none';
                        btnCloseCashier.style.display = 'inline-block';
                        currentOpenCashierId = cashierData.caixa_id;
                        // Ativa o PDV para vendas
                        setPdvActiveState(true);
                    } else {
                        currentCashierStatusSpan.textContent = 'Fechado';
                        currentCashierStatusSpan.style.color = 'red';
                        btnOpenCashier.style.display = 'inline-block';
                        btnCloseCashier.style.display = 'none';
                        currentOpenCashierId = null;
                        // Desativa o PDV para vendas
                        setPdvActiveState(false);
                        alert('Por favor, abra o caixa para iniciar as vendas.');
                        openCashierModal.style.display = 'flex'; // Abre modal de abertura automaticamente
                        openCashierUsername.textContent = userStatusData.username; // Usa o username já obtido
                        openCashierInitialBalanceInput.focus();
                        pdvState = 'OPEN_CASHIER_MODE'; // NOVO: Define estado ao abrir modal
                    }
                } else {
                    console.error('Erro ao verificar status do caixa:', cashierData.error);
                    currentCashierStatusSpan.textContent = 'Erro ao carregar';
                    currentCashierStatusSpan.style.color = 'orange';
                    setPdvActiveState(false);
                    alert('Erro ao verificar o status do caixa. Recarregue a página.');
                }

            } else {
                // Usuário não autenticado
                window.location.href = '/login/'; // Redireciona para a página de login
            }
        } catch (error) {
            console.error('Erro de conexão ao verificar login/caixa:', error);
            window.location.href = '/login/'; // Redireciona para o login em caso de erro de conexão
        }
    }

    function openCashierPrompt() {
        openCashierModal.style.display = 'flex';
        openCashierUsername.textContent = loggedInUsernameSpan.textContent; // Pega o nome do usuário logado
        openCashierInitialBalanceInput.value = '0.00';
        openCashierMessage.textContent = '';
        openCashierInitialBalanceInput.focus();
        pdvState = 'OPEN_CASHIER_MODE'; // Novo estado
    }

    // NOVO: Função para enviar requisição de Abertura de Caixa
    async function confirmOpenCashier() {
        openCashierMessage.textContent = '';
        const initialBalance = parseFloat(openCashierInitialBalanceInput.value.replace(',', '.'));

        if (isNaN(initialBalance) || initialBalance < 0) {
            openCashierMessage.textContent = 'Saldo inicial inválido.';
            openCashierMessage.classList.add('error');
            return;
        }

        try {
            const response = await fetch(DJANGO_URLS.openCashier, { // <<< CORREÇÃO
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify({ saldo_inicial: initialBalance })
            });
            const responseData = await response.json();

            if (response.ok) {
                openCashierMessage.textContent = responseData.message;
                openCashierMessage.classList.add('success');
                alert(responseData.message);
                openCashierModal.style.display = 'none';
                // Recarrega o status do caixa para atualizar a interface
                await checkLoginAndCashierStatus();
                pdvState = 'ADDING_PRODUCTS'; // Volta para o PDV
            } else {
                openCashierMessage.textContent = responseData.error || 'Erro ao abrir caixa.';
                openCashierMessage.classList.add('error');
            }
        } catch (error) {
            console.error('Erro de conexão ao abrir caixa:', error);
            openCashierMessage.textContent = 'Erro de conexão.';
            openCashierMessage.classList.add('error');
        }
    }

    // NOVO: Fecha o modal de Abertura de Caixa
    function closeOpenCashierModal() {
        openCashierModal.style.display = 'none';
        pdvState = 'PAYMENT_MODE'; // Volta para o modo de seleção de pagamento se veio de lá, ou ADDING_PRODUCTS
        // Ou simplesmente volta para o PDV desativado
        // Idealmente, se o caixa não foi aberto, o PDV permanece desativado
        setPdvActiveState(false);
    }

    // NOVO: Abre o modal de Fechamento de Caixa
    async function closeCashierPrompt() {
        // Obter dados do caixa atual (saldo inicial e total de vendas)
        // Isso requer uma API para somar as vendas do caixa. Por enquanto, só mostraremos o saldo inicial.
        // Você precisaria de uma view no Django para calcular o total de vendas de um caixa aberto.
        // Por exemplo: GET /api/caixa/detalhes/<caixa_id>/

        // Por agora, vamos buscar o saldo inicial do caixa atual para exibir.
        if (currentOpenCashierId) {
            try {
                const response = await fetch(DJANGO_URLS.cashierStatus); // Reutiliza API para pegar detalhes do caixa aberto
                const responseData = await response.json();
                if (response.ok && responseData.status === 'ABERTO' && responseData.caixa_id === currentOpenCashierId) {
                    closeCashierInitialBalanceDisplay.textContent = `R$ ${parseFloat(responseData.saldo_inicial).toFixed(2).replace('.', ',')}`;
                    // Para o total de vendas, precisaria de cálculo no backend
                    closeCashierSalesTotal.textContent = 'R$ 0,00 (Calcular!)'; // Placeholder
                }
            } catch (error) {
                console.error("Erro ao carregar detalhes do caixa para fechamento:", error);
                closeCashierSalesTotal.textContent = 'Erro';
            }
        }

        closeCashierModal.style.display = 'flex';
        closeCashierUsername.textContent = loggedInUsernameSpan.textContent;
        closeCashierFinalBalanceInput.value = '0.00';
        closeCashierMessage.textContent = '';
        closeCashierFinalBalanceInput.focus();
        pdvState = 'CLOSE_CASHIER_MODE'; // Novo estado
    }

    // NOVO: Função para enviar requisição de Fechamento de Caixa
    async function confirmCloseCashier() {
        closeCashierMessage.textContent = '';
        const finalBalance = parseFloat(closeCashierFinalBalanceInput.value.replace(',', '.'));

        if (isNaN(finalBalance) || finalBalance < 0) {
            closeCashierMessage.textContent = 'Saldo final inválido.';
            closeCashierMessage.classList.add('error');
            return;
        }

        try {
            const response = await fetch(DJANGO_URLS.closeCashier, { // <<< CORREÇÃO
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify({ saldo_final: finalBalance })
            });
            const responseData = await response.json();

            if (response.ok) {
                closeCashierMessage.textContent = responseData.message;
                closeCashierMessage.classList.add('success');
                alert(responseData.message);
                closeCashierModal.style.display = 'none';
                // Recarrega o status do caixa para atualizar a interface
                await checkLoginAndCashierStatus();
                // PDV estará desativado automaticamente pelo checkLoginAndCashierStatus
                startNewSale(); // Limpa o PDV para uma nova sessão
            } else {
                closeCashierMessage.textContent = responseData.error || 'Erro ao fechar caixa.';
                closeCashierMessage.classList.add('error');
            }
        } catch (error) {
            console.error('Erro de conexão ao fechar caixa:', error);
            closeCashierMessage.textContent = 'Erro de conexão.';
            closeCashierMessage.classList.add('error');
        }
    }

    // NOVO: Fecha o modal de Fechamento de Caixa
    function closeCloseCashierModal() {
        closeCashierModal.style.display = 'none';
        // PDV permanece desativado se o caixa foi fechado
        setPdvActiveState(false);
    }

    // NOVO: Lógica de Logout
    async function handleLogout() {
        if (confirm('Tem certeza que deseja sair?')) {
            try {
                const response = await fetch('/logout/', {
                    method: 'POST',
                    headers: {
                        // NOVO: Adicionar Content-Type e X-CSRFToken
                        'Content-Type': 'application/json', // Geralmente bom para requisições POST
                        'X-CSRFToken': getCookie('csrftoken') // <<< ESSENCIAL PARA O LOGOUT POST
                    },
                    body: JSON.stringify({}) // Envia um corpo vazio, mas é um POST
                });
                const responseData = await response.json();
                if (response.ok) {
                    alert(responseData.message);
                    window.location.href = '/login/'; // Redireciona para o login
                } else {
                    alert(`Erro ao fazer logout: ${responseData.error}`);
                }
            } catch (error) {
                console.error('Erro de conexão ao fazer logout:', error);
                alert('Erro de conexão ao fazer logout.');
            }
        }
    }

    // NOVO: Função para ativar/desativar a interface principal do PDV
    function setPdvActiveState(isActive) {
        barcodeInput.disabled = !isActive;
        btnFinalizeSale.disabled = !isActive;
        btnApplyDiscount.disabled = !isActive;
        // Você pode adicionar mais elementos aqui para desativar/ativar
        // Ex: productTableBody.classList.toggle('disabled', !isActive);
        // Ou sobrepor com uma div de "caixa fechado"
    }

    // Gerencia o foco no input de código de barras
    function focusBarcodeInput() {
        if (pdvState === 'ADDING_PRODUCTS') {
            barcodeInput.focus();
        } else {
            barcodeInput.blur(); // Tira o foco se não estiver no modo certo
        }
    }

    // Atualiza a lista de produtos na tela (interface)
    function updateProductList() {
        productTableBody.innerHTML = '';

        if (saleItems.length === 0) {
            productTableBody.innerHTML = `
                <tr class="placeholder-row">
                    <td colspan="5" class="text-center">Nenhum produto adicionado ainda.</td>
                </tr>
            `;
            updateTotals();
            return;
        }

        saleItems.forEach((item, index) => {
            const row = productTableBody.insertRow();
            row.dataset.index = index;

            row.innerHTML = `
                <td>${item.name}</td>
                <td>
                    <input type="number" value="${item.quantity}" min="0.001" step="0.001" class="item-quantity-input" data-index="${index}">
                    <span class="product-unit-display">${item.unidadeMedida || ''}</span>
                </td>
                <td>R$ ${item.unitPrice.toFixed(2).replace('.', ',')}</td>
                <td>R$ ${(item.quantity * item.unitPrice).toFixed(2).replace('.', ',')}</td>
                <td><button class="remove-item-btn" data-index="${index}">X</button></td>
            `;
        });

        updateTotals();
    }

    // Atualiza os totais da venda (subtotal, desconto, total)
    function updateTotals() {
        let subtotal = 0;
        saleItems.forEach(item => {
            subtotal += item.quantity * item.unitPrice;
        });

        const discount = 0; // Lógica de desconto virá depois

        subtotalSpan.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
        discountsSpan.textContent = `R$ ${discount.toFixed(2).replace('.', ',')}`;
        finalTotalSpan.textContent = `R$ ${(subtotal - discount).toFixed(2).replace('.', ',')}`;
    }

    // Adiciona um produto ao carrinho (com busca AJAX e modal para itens por peso/quantidade)
    async function addProduct(productCode) {
        if (!productCode) return;

        console.log(`Buscando produto com código: ${productCode}...`);

        try {
            const response = await fetch(`/produtos/api/buscar-produto/?codigo_barras=${productCode}`);

            if (!response.ok) {
                const errorData = await response.json();
                alert(`Erro ao buscar produto: ${errorData.error || response.statusText}`);
                barcodeInput.value = '';
                focusBarcodeInput();
                return;
            }

            const productData = await response.json();

            let product = {
                id: productData.id,
                name: productData.nome,
                unitPrice: parseFloat(productData.preco_venda),
                codigoBarras: productData.codigo_barras,
                unidadeMedida: productData.unidade_medida
            };

            const unitsRequiringInput = ['KG', 'L', 'M', 'DZ', 'CX'];
            if (unitsRequiringInput.includes(product.unidadeMedida)) {
                currentProductForModal = product;
                modalProductName.textContent = product.name;
                modalUnitDisplay.textContent = product.unidadeMedida;
                modalQuantityInput.value = '';
                modalErrorMessage.textContent = '';

                quantityInputModal.style.display = 'flex';
                pdvState = 'QUANTITY_INPUT_MODE';
                modalQuantityInput.focus();
            } else {
                const existingItem = saleItems.find(item => item.id === product.id);
                if (existingItem) {
                    existingItem.quantity += 1;
                } else {
                    saleItems.push({ ...product, quantity: 1 });
                }
                updateProductList();
                barcodeInput.value = '';
                focusBarcodeInput();
            }

        } catch (error) {
            console.error('Erro na requisição AJAX:', error);
            alert('Não foi possível conectar ao servidor para buscar o produto. Verifique sua conexão.');
            barcodeInput.value = '';
            focusBarcodeInput();
        }
    }

    // Adiciona o produto ao carrinho a partir do modal de quantidade/peso
    function addProductFromModal() {
        let quantityText = modalQuantityInput.value.trim();
        modalErrorMessage.textContent = '';

        quantityText = quantityText.replace(',', '.');
        let quantity = parseFloat(quantityText);

        if (isNaN(quantity) || quantity <= 0) {
            modalErrorMessage.textContent = 'Por favor, digite uma quantidade/peso válido.';
            modalQuantityInput.focus();
            return;
        }

        const existingItem = saleItems.find(item => item.id === currentProductForModal.id);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            saleItems.push({ ...currentProductForModal, quantity: quantity });
        }

        updateProductList();
        closeQuantityModal();
    }

    // Fecha o modal de quantidade/peso
    function closeQuantityModal() {
        quantityInputModal.style.display = 'none';
        pdvState = 'ADDING_PRODUCTS';
        barcodeInput.value = '';
        focusBarcodeInput();
        currentProductForModal = null;
    }

    // Inicia uma nova venda, limpando o PDV e resetando o estado
    function startNewSale() {
        saleItems = [];
        updateProductList();
        paymentArea.style.display = 'none';
        pixPaymentModal.style.display = 'none'; // Garante que o modal PIX esteja escondido
        modalQrcodeDisplay.innerHTML = ''; // Limpa o QR Code
        modalPixCopyPasteCode.value = ''; // Limpa o código copia e cola

        btnNewSale.style.display = 'none';
        btnFinalizeSale.style.display = 'inline-block';
        btnCancelSale.style.display = 'inline-block';
        btnApplyDiscount.style.display = 'inline-block';

        pdvState = 'ADDING_PRODUCTS';
        focusBarcodeInput();
        console.log('Nova Venda Iniciada!');
    }

    // Função para enviar os dados da venda para o backend e finalizar a transação
    async function finalizeSaleBackend(formaPagamento, transacaoIdProvedor = null) {
        const totalBruto = parseFloat(subtotalSpan.textContent.replace('R$ ', '').replace(',', '.'));
        const desconto = parseFloat(discountsSpan.textContent.replace('R$ ', '').replace(',', '.'));
        const totalLiquido = parseFloat(finalTotalSpan.textContent.replace('R$ ', '').replace(',', '.'));

        const vendaData = {
            itens: saleItems.map(item => ({
                id: item.id,
                quantity: item.quantity,
                unitPrice: item.unitPrice
            })),
            forma_pagamento: formaPagamento,
            total_bruto: totalBruto,
            desconto: desconto,
            total_liquido: totalLiquido,
            transacao_id_provedor: transacaoIdProvedor,
            caixa_id: currentOpenCashierId // NOVO: Passa o ID do caixa aberto
        };

        try {
            const response = await fetch(DJANGO_URLS.finalizeSale, { // <<< CORREÇÃO
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify(vendaData)
            });

            const responseData = await response.json();

            if (response.ok) {
                console.log('Venda finalizada com sucesso!', responseData);
                modalPixStatus.style.color = 'green'; // Atualiza status no modal PIX se veio de lá
                modalPixStatus.textContent = `PAGAMENTO CONFIRMADO! Venda #${responseData.venda_id} finalizada!`;

                // Prepara a interface para uma nova venda
                saleItems = [];
                updateProductList();
                paymentArea.style.display = 'none'; // Esconde a área de pagamento principal
                pixPaymentModal.style.display = 'none'; // Esconde o modal PIX
                modalQrcodeDisplay.innerHTML = ''; // Limpa o QR Code para a próxima vez
                modalPixCopyPasteCode.value = ''; // Limpa o código copia e cola

                btnFinalizeSale.style.display = 'none';
                btnCancelSale.style.display = 'none';
                btnApplyDiscount.style.display = 'none';
                btnNewSale.style.display = 'block'; // Mostra botão Nova Venda

                pdvState = 'SALE_COMPLETED_MODE'; // Define o estado para "venda concluída"

            } else {
                console.error('Erro ao finalizar venda:', responseData);
                // Exibe o erro na área do modal PIX se estiver nele, ou num alerta
                if (pdvState === 'PIX_MODAL_MODE') {
                    modalPixStatus.style.color = 'red';
                    modalPixStatus.textContent = `ERRO FINALIZAÇÃO: ${responseData.error || 'Verifique o console.'}`;
                    // Permite ao operador cancelar ou tentar novamente
                } else {
                    alert(`Erro ao finalizar venda: ${responseData.error || 'Verifique o console.'}`);
                }
                // Permanece no modo de pagamento para o usuário poder ajustar ou tentar de novo
                pdvState = 'PAYMENT_MODE';
            }
        } catch (error) {
            console.error('Erro na requisição de finalização de venda:', error);
            if (pdvState === 'PIX_MODAL_MODE') {
                 modalPixStatus.style.color = 'red';
                 modalPixStatus.textContent = 'ERRO DE CONEXÃO AO FINALIZAR.';
            } else {
                alert('Erro de conexão com o servidor ao finalizar a venda.');
            }
            pdvState = 'PAYMENT_MODE';
        }
    }

    // --- Funções de Ação Principal (chamadas por botões ou atalhos) ---
    async function finalizeSale() {
        if (saleItems.length === 0) {
            alert('Adicione produtos à venda antes de finalizar!');
            return;
        }
        console.log('Finalizar Venda acionado! Entrando no modo de pagamento.');
        paymentArea.style.display = 'block'; // Mostra a área de seleção de pagamento
        paymentDetailsDiv.innerHTML = '<p>Selecione a forma de pagamento desejada.</p>';
        pdvState = 'PAYMENT_MODE'; // Define o estado para seleção de pagamento
        barcodeInput.blur(); // Tira o foco do input principal
        // Não preenche paymentDetailsDiv.innerHTML aqui, pois o conteúdo será gerado dinamicamente
        // ou o modal PIX será aberto
    }

    function cancelSale() {
        if (confirm('Tem certeza que deseja cancelar esta venda? Todos os itens serão removidos.')) {
            startNewSale(); // Reutiliza a lógica de iniciar nova venda para limpar tudo
            console.log('Venda Cancelada!');
        }
    }

    function applyDiscount() {
        console.log('Aplicar Desconto acionado!');
        alert('Funcionalidade de Desconto em desenvolvimento!');
    }

    // Lida com a seleção da forma de pagamento (Dinheiro, Cartão, PIX, Criptomoeda)
    async function handlePaymentSelection(option) {
        if (pdvState !== 'PAYMENT_MODE') {
            console.warn('Tentativa de seleção de pagamento fora do modo de pagamento.');
            return;
        }

        let formaPagamento = '';
        let requiresInstantFinalization = false; // Flag para pagamentos que finalizam de imediato

        if (option === 1) {
            formaPagamento = 'DINHEIRO';
            requiresInstantFinalization = true;
        } else if (option === 2) {
            formaPagamento = 'CARTAO';
            requiresInstantFinalization = true;
        } else if (option === 3) {
            formaPagamento = 'PIX';
            // PIX não finaliza imediatamente, entra no modo modal para QR/Polling
        } else if (option === 4) {
            formaPagamento = 'CRIPTOMOEDA';
            // Criptomoeda também não finaliza imediatamente
        } else {
            // Se nenhuma opção válida, limpa a área de detalhes
            paymentDetailsDiv.innerHTML = 'Opção de pagamento inválida.';
            return;
        }

        // Se for um pagamento que finaliza imediatamente (Dinheiro/Cartão)
        if (requiresInstantFinalization) {
            paymentDetailsDiv.innerHTML = `<p>Processando pagamento com ${formaPagamento}...</p>`; // Mostra status na área principal
            await finalizeSaleBackend(formaPagamento);
            return;
        }

        // Lógica Específica para PIX
        if (formaPagamento === 'PIX') {
            const totalLiquido = parseFloat(finalTotalSpan.textContent.replace('R$ ', '').replace(',', '.'));
            try {
                // Esconde a área de pagamento principal e exibe o modal PIX
                paymentArea.style.display = 'none';
                pixPaymentModal.style.display = 'flex';
                pdvState = 'PIX_MODAL_MODE'; // Muda o estado do PDV para o modal PIX
                barcodeInput.blur(); // Tira o foco do input principal

                // Preenche informações no modal PIX enquanto aguarda a API
                modalPixTotal.textContent = `R$ ${totalLiquido.toFixed(2).replace('.', ',')}`;
                modalPixCopyPasteCode.value = ''; // Limpa
                modalPixTxid.textContent = 'Gerando...';
                modalPixStatus.textContent = 'GERANDO QR CODE...';
                modalQrcodeDisplay.innerHTML = ''; // Limpa QR code anterior

                const response = await fetch(DJANGO_URLS.generatePix, { // <<< CORREÇÃO
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                    body: JSON.stringify({
                        valor: totalLiquido,
                        descricao: `Venda PDV - R$ ${totalLiquido.toFixed(2).replace('.', ',')}`
                    })
                });

                const responseData = await response.json();

                if (response.ok) {
                    const qrCodeUrl = responseData.qr_code_url;
                    const codigoCopiaCola = responseData.codigo_copia_cola;
                    const transacaoIdProvedor = responseData.transacao_id_provedor;

                    // Atualiza o modal com os dados reais do PIX gerado
                    modalPixCopyPasteCode.value = codigoCopiaCola;
                    modalPixTxid.textContent = transacaoIdProvedor;
                    modalPixStatus.textContent = 'AGUARDANDO PAGAMENTO...';
                    modalPixStatus.style.color = 'green';

                    // Gera e exibe o QR Code no modal
                    new QRCode(modalQrcodeDisplay, {
                        text: codigoCopiaCola,
                        width: 180,
                        height: 180,
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.H
                    });

                    // Foca o botão de copiar para acessibilidade via teclado
                    modalCopyPixButton.focus();

                    // ### INICIA O POLLING AUTOMÁTICO ###
                    startPixPolling(transacaoIdProvedor, formaPagamento);

                } else {
                    console.error('Erro ao gerar PIX:', responseData);
                    modalPixStatus.style.color = 'red';
                    modalPixStatus.textContent = `ERRO GERAÇÃO: ${responseData.error || 'Verifique o console.'}`;
                    stopPixPolling(); // Em caso de erro, para o polling
                }

            } catch (error) {
                console.error('Erro na requisição para gerar PIX:', error);
                modalPixStatus.style.color = 'red';
                modalPixStatus.textContent = 'ERRO DE CONEXÃO AO GERAR PIX.';
                stopPixPolling(); // Em caso de erro, para o polling
            }

        } else if (formaPagamento === 'CRIPTOMOEDA') {
            const totalLiquido = parseFloat(finalTotalSpan.textContent.replace('R$ ', '').replace(',', '.'));

            // Simplesmente abre o modal e carrega as opções
            paymentArea.style.display = 'none';
            cryptoPaymentModal.style.display = 'flex';
            pdvState = 'CRYPTO_MODAL_MODE';
            barcodeInput.blur();

            modalCryptoTotal.textContent = `R$ ${totalLiquido.toFixed(2).replace('.', ',')}`;
            cryptoSelectionErrorMessage.textContent = ''; // Limpa mensagens de erro

            // Oculta a seção de detalhes de pagamento do QR/Endereço até que o pagamento seja gerado
            cryptoPaymentDetailsSections.style.display = 'none';
            btnGenerateCryptoPayment.style.display = 'block'; // Mostra o botão Gerar Pagamento

            // As criptomoedas já foram carregadas no `DOMContentLoaded`, mas o dropdown pode estar vazio
            // se o carregamento falhou.
            // Se o dropdown não estiver preenchido, pode-se tentar carregar novamente ou exibir erro.
            if (availableCryptos.length === 0) {
                 loadCryptocurrencies(); // Recarrega se estiver vazio (caso tenha falhado na 1a vez)
            }
            // Garante que o select tenha um valor vazio selecionado inicialmente
            cryptoCurrencySelect.value = '';
            modalCryptoMinBRL.textContent = 'Carregando...';

            cryptoCurrencySelect.focus();

            // if (!pay_currency) {
            //     alert('Por favor, selecione uma criptomoeda para o pagamento.');
            //     cryptoPaymentModal.style.display = 'none'; // Esconde modal se não selecionado
            //     paymentArea.style.display = 'block'; // Volta para a tela de seleção
            //     pdvState = 'PAYMENT_MODE';
            //     return;
            // }

            // Opcional: Verifique se o valor total da venda é maior que o mínimo da cripto
            const selectedCrypto = availableCryptos.find(c => c.code === pay_currency);
            if (selectedCrypto && totalLiquido < (parseFloat(selectedCrypto.min_amount) * USD_TO_BRL_RATE)) { // Conversão simplificada
                alert(`O valor total da venda (R$ ${totalLiquido.toFixed(2).replace('.', ',')}) é menor que o mínimo transacionável para ${selectedCrypto.name} (~ R$ ${(parseFloat(selectedCrypto.min_amount) * USD_TO_BRL_RATE).toFixed(2).replace('.', ',')}).`);
                // Permite ao usuário voltar e escolher outra cripto ou forma de pagamento
                cryptoPaymentModal.style.display = 'none';
                paymentArea.style.display = 'block';
                pdvState = 'PAYMENT_MODE';
                return;
            }

            try {
                paymentArea.style.display = 'none';
                cryptoPaymentModal.style.display = 'flex';
                pdvState = 'CRYPTO_MODAL_MODE';
                barcodeInput.blur();

                modalCryptoTotal.textContent = `R$ ${totalLiquido.toFixed(2).replace('.', ',')}`;
                modalCryptoCurrencyName.textContent = pay_currency;
                modalCryptoAmount.textContent = 'Gerando...';
                modalCryptoAddress.value = 'Gerando endereço...';
                modalCryptoPaymentId.textContent = 'Gerando...';
                modalCryptoStatus.textContent = 'GERANDO ENDEREÇO E QR CODE...';
                modalCryptoQrcodeDisplay.innerHTML = '';

                const response = await fetch('/vendas/api/gerar-cripto/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    body: JSON.stringify({
                        valor: totalLiquido,
                        criptomoeda_destino: pay_currency,
                        descricao: `Venda PDV Cripto - R$ ${totalLiquido.toFixed(2).replace('.', ',')}`
                    })
                });

                const responseData = await response.json();

                // --- NOVO DEBUGGING AQUI: IMPRIME A RESPOSTA BRUTA DO BACKEND ---
                console.log("\n--- DEBUG Frontend: responseData de /vendas/api/gerar-cripto/ (RAW) ---");
                console.log(responseData);
                console.log("--- FIM DEBUG Frontend (RAW) ---\n");


                if (response.ok) {
                    // --- CORREÇÃO AQUI: Garante que o payment_id seja lido de forma robusta ---
                    const paymentId = responseData.payment_id; // Leia diretamente

                    if (!paymentId) { // VERIFICA SE ESTÁ VAZIO/UNDEFINED
                        console.error("ERRO FATAL: payment_id não recebido da NOWPayments na resposta de geração.");
                        modalCryptoStatus.style.color = 'red';
                        modalCryptoStatus.textContent = 'ERRO: ID de Pagamento não recebido da NOWPayments. Verifique o console.';
                        stopCryptoPolling();
                        return;
                    }
                    // --- FIM DA CORREÇÃO ---


                    const payAmount = responseData.pay_amount;
                    const payAddress = responseData.pay_address;
                    const paymentUrl = responseData.payment_url;
                    const paymentStatus = responseData.payment_status;

                    // --- NOVO DEBUGGING: IMPRIME paymentUrl NO CONSOLE ---
                   console.log(`[DEBUG_QR] paymentUrl para o QR Code: '${paymentUrl}'`);
                   console.log(`[DEBUG_QR] Tipo de paymentUrl: ${typeof paymentUrl}`);
                   // --- FIM DO NOVO DEBUGGING ---

                    const cryptoQrCodeText = `tron:${payAddress}?amount=${payAmount}`;

                    modalCryptoAmount.textContent = `${payAmount} ${pay_currency}`;
                    modalCryptoAddress.value = payAddress;
                    modalCryptoPaymentId.textContent = paymentId; // Usa paymentId
                    modalCryptoStatus.textContent = `STATUS INICIAL: ${paymentStatus}`;
                    modalCryptoStatus.style.color = 'orange';

                    new QRCode(modalCryptoQrcodeDisplay, {
                        text: cryptoQrCodeText,
                        width: 180,
                        height: 180,
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.H
                    });

                    modalCopyCryptoAddressButton.focus();
                    startCryptoPolling(paymentId, formaPagamento); // Passa paymentId

                } else {
                    console.error('Erro ao gerar Criptomoeda:', responseData);
                    modalCryptoStatus.style.color = 'red';
                    modalCryptoStatus.textContent = `ERRO GERAÇÃO: ${responseData.error || 'Verifique o console.'}`;
                    stopCryptoPolling();
                }

            } catch (error) {
                console.error('Erro na requisição para gerar Criptomoeda:', error);
                modalCryptoStatus.style.color = 'red';
                modalCryptoStatus.textContent = 'ERRO DE CONEXÃO.';
                stopCryptoPolling();
            }
        }
    }

    // Fecha o modal de pagamento PIX e volta para seleção de pagamento
    function closePixModal() {
        stopPixPolling(); // Garante que o polling pare ao fechar o modal
        pixPaymentModal.style.display = 'none';
        modalQrcodeDisplay.innerHTML = '';
        modalPixCopyPasteCode.value = '';
        modalPixTxid.textContent = '';
        modalPixStatus.textContent = '';

        pdvState = 'PAYMENT_MODE'; // Volta para o estado de seleção de pagamento
        paymentArea.style.display = 'block'; // Reexibe a área de pagamento principal
        // O foco volta para o barcodeInput se o usuário sair do modo de pagamento com 'Backspace'
    }

    // --- Funções de Polling do PIX ---
    async function checkPixStatus(txid, formaPagamento) {
        // Verifica se o tempo limite do polling foi atingido
        if (Date.now() - pixPollingStartTime > PIX_POLLING_TIMEOUT_MS) {
            modalPixStatus.style.color = 'red';
            modalPixStatus.textContent = 'PAGAMENTO PIX EXPIRADO OU NÃO CONFIRMADO.';
            stopPixPolling();
            alert('Pagamento PIX expirado ou não confirmado. Por favor, selecione outra forma de pagamento ou gere um novo PIX.');
            closePixModal(); // Fecha o modal e volta para seleção de pagamento
            return;
        }

        try {
            const response = await fetch(`${DJANGO_URLS.consultPixStatus}?txid=${txid}`); // <<< CORREÇÃO AQUI!
            const responseData = await response.json();

            if (response.ok) {
                const status = responseData.status;
                modalPixStatus.textContent = `STATUS: ${status}...`;

                if (status === 'CONCLUIDA') {
                    modalPixStatus.style.color = 'green';
                    modalPixStatus.textContent = 'PAGAMENTO CONFIRMADO!';
                    stopPixPolling();
                    await finalizeSaleBackend(formaPagamento, txid); // Finaliza a venda real
                    // O modal de PIX será fechado automaticamente pela finalizeSaleBackend ao ir para SALE_COMPLETED_MODE
                } else if (status === 'ATIVA') {
                    modalPixStatus.style.color = 'orange'; // Cor para status pendente
                    modalPixStatus.textContent = 'AGUARDANDO PAGAMENTO...';
                } else if (status === 'EXPIRADA' || status === 'CANCELADA' || status === 'REMOVIDA_PELO_USUARIO_RECEBEDOR' || status === 'DEVOLVIDA') { // Adicionados mais status de falha
                    modalPixStatus.style.color = 'red';
                    modalPixStatus.textContent = `PAGAMENTO ${status.replace('_', ' ').toUpperCase()}!`;
                    stopPixPolling();
                    alert(`Pagamento PIX ${status.replace('_', ' ')}. Por favor, selecione outra forma de pagamento ou gere um novo PIX.`);
                    closePixModal();
                } else {
                    modalPixStatus.style.color = 'blue';
                    modalPixStatus.textContent = `STATUS DESCONHECIDO: ${status}`;
                }

            } else {
                console.error('Erro ao consultar status PIX:', responseData);
                modalPixStatus.style.color = 'red';
                modalPixStatus.textContent = `ERRO CONSULTA: ${responseData.error || 'Verifique o console.'}`;
                stopPixPolling();
                alert('Erro ao consultar status do PIX. Tente novamente.');
                closePixModal();
            }
        } catch (error) {
            console.error('Erro de conexão ao consultar status PIX:', error);
            modalPixStatus.style.color = 'red';
            modalPixStatus.textContent = 'ERRO DE CONEXÃO AO CONSULTAR STATUS.';
            stopPixPolling();
            alert('Erro de conexão ao consultar status do PIX. Verifique sua rede.');
            closePixModal();
        }
    }

    function startPixPolling(txid, formaPagamento) {
        stopPixPolling();
        pixPollingStartTime = Date.now();
        checkPixStatus(txid, formaPagamento); // Chama imediatamente
        pixPollingInterval = setInterval(() => checkPixStatus(txid, formaPagamento), PIX_POLLING_INTERVAL_MS);
    }

    function stopPixPolling() {
        if (pixPollingInterval) {
            clearInterval(pixPollingInterval);
            pixPollingInterval = null;
            pixPollingStartTime = null;
        }
    }

    async function checkCryptoStatus(paymentId, formaPagamento) { // Parâmetro agora é paymentId
         if (Date.now() - cryptoPollingStartTime > PIX_POLLING_TIMEOUT_MS) {
             modalCryptoStatus.style.color = 'red';
             modalCryptoStatus.textContent = 'PAGAMENTO CRIPTO EXPIRADO OU NÃO CONFIRMADO.';
             stopCryptoPolling();
             alert('Pagamento Cripto expirado ou não confirmado. Por favor, selecione outra forma de pagamento ou gere um novo PIX.');
             closeCryptoModal();
             return;
         }

         try {
             // Requisição para nossa API de status, passando payment_id
             const response = await fetch(`${DJANGO_URLS.consultCryptoStatus}?payment_id=${paymentId}`);
             const responseData = await response.json();

             if (response.ok) {
                 const status = responseData.status; // Status da NOWPayments

                 modalCryptoStatus.textContent = `STATUS: ${status}...`;

                 // Status da NOWPayments: waiting, confirming, paid, partially_paid, failed, refunded
                 if (status === 'paid') {
                     modalCryptoStatus.style.color = 'green';
                     modalCryptoStatus.textContent = 'PAGAMENTO CONFIRMADO!';
                     stopCryptoPolling();
                     await finalizeSaleBackend(formaPagamento, paymentId); // Passa paymentId para o backend
                     // O modal Cripto será fechado automaticamente pela finalizeSaleBackend
                 } else if (status === 'waiting' || status === 'confirming') {
                     modalCryptoStatus.style.color = 'orange';
                     modalCryptoStatus.textContent = 'AGUARDANDO PAGAMENTO...';
                 } else if (status === 'partially_paid') {
                     modalCryptoStatus.style.color = 'blue';
                     modalCryptoStatus.textContent = `PAGAMENTO PARCIAL!`; // Considere como lidar com isso no PDV
                 } else if (status === 'failed' || status === 'expired' || status === 'refunded' || status === 'cancelled' || status === 'partially_expired') { // Adicionados outros status de falha
                     modalCryptoStatus.style.color = 'red';
                     modalCryptoStatus.textContent = `PAGAMENTO ${status.replace('_', ' ').toUpperCase()}!`;
                     stopCryptoPolling();
                     alert(`Pagamento Cripto ${status.replace('_', ' ').toUpperCase()}. Por favor, selecione outra forma de pagamento ou gere um novo.`);
                     closeCryptoModal();
                 } else {
                     modalCryptoStatus.style.color = 'blue';
                     modalCryptoStatus.textContent = `STATUS DESCONHECIDO: ${status}`;
                 }

             } else {
                 console.error('Erro ao consultar status Cripto:', responseData);
                 modalCryptoStatus.style.color = 'red';
                 modalCryptoStatus.textContent = `ERRO CONSULTA: ${responseData.error || 'Verifique o console.'}`;
                 stopCryptoPolling();
                 alert('Erro ao consultar status do Pagamento Cripto. Tente novamente.');
                 closeCryptoModal();
             }
         } catch (error) {
             console.error('Erro de conexão ao consultar status Cripto:', error);
             modalCryptoStatus.style.color = 'red';
             modalCryptoStatus.textContent = 'ERRO DE CONEXÃO AO CONSULTAR STATUS.';
             stopCryptoPolling();
             alert('Erro de conexão ao consultar status do Pagamento Cripto. Verifique sua rede.');
             closeCryptoModal();
         }
     }

    async function generateCryptoPayment() {
        const pay_currency = cryptoCurrencySelect.value;
        const totalLiquido = parseFloat(finalTotalSpan.textContent.replace('R$ ', '').replace(',', '.'));

        if (!pay_currency) {
            cryptoSelectionErrorMessage.textContent = 'Por favor, selecione uma criptomoeda.';
            cryptoCurrencySelect.focus();
            return;
        }

        // Validação de mínimo (reutiliza a lógica existente)
        const selectedCrypto = availableCryptos.find(c => c.code === pay_currency);
        // Precisamos do min_amount em BRL para esta validação
        let minAmountInBRL = 0;
        if (selectedCrypto && selectedCrypto.min_amount) {
            let minInCryptoUnit = parseFloat(selectedCrypto.min_amount);
            // Assumindo que min_amount é em USD para stablecoins, para outras precisaria de cotação
            minAmountInBRL = minInCryptoUnit * USD_TO_BRL_RATE;
            if (totalLiquido < minAmountInBRL) {
                cryptoSelectionErrorMessage.textContent = `O valor da venda (R$ ${totalLiquido.toFixed(2).replace('.', ',')}) é menor que o mínimo transacionável para ${selectedCrypto.name} (~ R$ ${minAmountInBRL.toFixed(2).replace('.', ',')}).`;
                return;
            }
        } else {
            // Caso não tenha conseguido carregar o mínimo, alerta ou impede.
            // Aqui, vamos tentar gerar mesmo sem o mínimo visível se a moeda foi selecionada.
            console.warn("Mínimo transacionável não disponível para a moeda selecionada.");
        }

        // Esconde o botão de gerar e mostra o status de geração
        btnGenerateCryptoPayment.style.display = 'none';
        cryptoSelectionErrorMessage.textContent = 'Gerando pagamento...';

        try {
            const response = await fetch(DJANGO_URLS.generateCrypto, { // <<< CORREÇÃO
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify({
                    valor: totalLiquido,
                    criptomoeda_destino: pay_currency,
                    descricao: `Venda PDV Cripto - R$ ${totalLiquido.toFixed(2).replace('.', ',')}`
                })
            });

            const responseData = await response.json();

            // --- DEBUGGING: responseData de /vendas/api/gerar-cripto/ ---
            console.log("\n--- DEBUG Frontend: responseData de /vendas/api/gerar-cripto/ (RAW) ---");
            console.log(responseData);
            console.log("--- FIM DEBUG Frontend (RAW) ---\n");

            if (response.ok) {
                const paymentId = responseData.payment_id;
                if (!paymentId) {
                    console.error("ERRO FATAL: payment_id não recebido da NOWPayments na resposta de geração.");
                    cryptoSelectionErrorMessage.textContent = 'ERRO: ID de Pagamento não recebido. Verifique o console.';
                    btnGenerateCryptoPayment.style.display = 'block'; // Reexibe botão para tentar de novo
                    return;
                }

                const payAmount = responseData.pay_amount;
                const payAddress = responseData.pay_address;
                const paymentStatus = responseData.payment_status;

                const network = selectedCrypto.network// Usa o network, se não, o código da moeda

                let qrCodePrefix = '';
                // Construir o prefixo da URI de pagamento com base na rede
                if (network && network.toLowerCase() === 'tron') { // Para TRX, USDTTRC20, etc.
                    qrCodePrefix = 'tron';
                } else if (network && network.toLowerCase() === 'bitcoin') { // Para BTC
                    qrCodePrefix = 'bitcoin';
                } else if (network && network.toLowerCase() === 'ethereum') { // Para ETH, ERC20
                    qrCodePrefix = 'ethereum';
                } else {
                    // Para outras redes ou se network não for claro, use o código da moeda em minúsculas
                    qrCodePrefix = pay_currency.toLowerCase();
                }

                const cryptoQrCodeText = `${network}:${payAddress}?amount=${payAmount}`; // <<< CORREÇÃO AQUI!



                // Preenche os campos de detalhes do pagamento gerado
                modalCryptoAmount.textContent = `${payAmount} ${pay_currency.toUpperCase()}`;
                modalCryptoAddress.value = payAddress;
                modalCryptoPaymentId.textContent = paymentId;
                modalCryptoStatus.textContent = `STATUS INICIAL: ${paymentStatus}...`;
                modalCryptoStatus.style.color = 'orange';

                // Exibe a seção de detalhes do pagamento
                cryptoPaymentDetailsSections.style.display = 'block';

                // Gera e exibe o QR Code no modal
                new QRCode(modalCryptoQrcodeDisplay, {
                    text: cryptoQrCodeText,
                    width: 180,
                    height: 180,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });

                modalCopyCryptoAddressButton.focus();
                startCryptoPolling(paymentId, 'CRIPTOMOEDA');

            } else {
                console.error('Erro ao gerar Criptomoeda:', responseData);
                cryptoSelectionErrorMessage.textContent = `ERRO GERAÇÃO: ${responseData.error || 'Verifique o console.'}`;
                btnGenerateCryptoPayment.style.display = 'block'; // Reexibe botão para tentar de novo
            }

        } catch (error) {
            console.error('Erro na requisição para gerar Criptomoeda:', error);
            cryptoSelectionErrorMessage.textContent = 'ERRO DE CONEXÃO.';
            btnGenerateCryptoPayment.style.display = 'block'; // Reexibe botão para tentar de novo
        }
    }

     // A função startCryptoPolling também precisa ter o parâmetro renomeado de txnId para paymentId
     function startCryptoPolling(paymentId, formaPagamento) { // Renomeado aqui também
         stopCryptoPolling();
         cryptoPollingStartTime = Date.now();
         checkCryptoStatus(paymentId, formaPagamento);
         cryptoPollingInterval = setInterval(() => checkCryptoStatus(paymentId, formaPagamento), PIX_POLLING_INTERVAL_MS);
     }

    function stopCryptoPolling() {
        if (cryptoPollingInterval) {
            clearInterval(cryptoPollingInterval);
            cryptoPollingInterval = null;
            cryptoPollingStartTime = null;
        }
    }

    // Função para fechar o modal de criptomoeda
    function closeCryptoModal() {
        stopCryptoPolling();
        cryptoPaymentModal.style.display = 'none';
        // Limpa os elementos específicos do modal Cripto
        modalCryptoQrcodeDisplay.innerHTML = '';
        modalCryptoAddress.value = '';
        modalCryptoPaymentId.textContent = '';
        modalCryptoTotal.textContent = 'R$ 0,00'; // Resetar o total
        modalCryptoCurrencyName.textContent = ''; // Resetar nome da moeda
        modalCryptoAmount.textContent = ''; // Resetar valor em cripto
        modalCryptoStatus.textContent = '';
        modalCryptoMinBRL.textContent = 'Carregando...'; // Resetar texto do mínimo
        cryptoCurrencySelect.value = ''; // Reseta o dropdown
        cryptoSelectionErrorMessage.textContent = ''; // Limpa mensagem de erro

        cryptoPaymentDetailsSections.style.display = 'none'; // Oculta a seção de detalhes
        btnGenerateCryptoPayment.style.display = 'block'; // Garante que o botão de gerar apareça na próxima vez

        pdvState = 'PAYMENT_MODE';
        paymentArea.style.display = 'block';

        if (paymentOptionsButtons.length > 0) {
            paymentOptionsButtons[0].focus();
        }
    }

    async function loadCryptocurrencies() {
        try {
            const response = await fetch(DJANGO_URLS.listCryptos);
            const responseData = await response.json();

            if (response.ok && responseData.currencies) {
                availableCryptos = responseData.currencies;
                cryptoCurrencySelect.innerHTML = ''; // Limpa as opções existentes

                // Adiciona uma opção padrão "selecione"
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Selecione uma criptomoeda';
                defaultOption.disabled = true;
                defaultOption.selected = true;
                cryptoCurrencySelect.appendChild(defaultOption);

                // Adiciona as criptomoedas à lista
                availableCryptos.forEach(crypto => { // <<< ESTA É A LINHA QUE DEVE SER USADA
                    const option = document.createElement('option');
                    option.value = crypto.code;
                    option.textContent = `${crypto.name} (${crypto.code.toUpperCase()})`;
                    option.dataset.minAmount = crypto.min_amount;
                    cryptoCurrencySelect.appendChild(option);
                });

                // Seleciona a criptomoeda padrão (USDTTRC20) e atualiza o mínimo se ela estiver na lista
                const defaultPayCurrency = 'USDTTRC20';
                if (cryptoCurrencySelect.querySelector(`option[value="${defaultPayCurrency}"]`)) {
                    cryptoCurrencySelect.value = defaultPayCurrency;
                    updateMinAmountDisplay(defaultPayCurrency); // Já chama o mínimo para a padrão
                } else if (availableCryptos.length > 0) {
                     cryptoCurrencySelect.value = availableCryptos[0].code;
                     updateMinAmountDisplay(availableCryptos[0].code);
                } else {
                    // Se não houver criptomoedas carregadas, exibe mensagem apropriada
                    modalCryptoMinBRL.textContent = 'N/A';
                }


            } else {
                console.error('Erro ao carregar criptomoedas:', responseData.error);
                cryptoCurrencySelect.innerHTML = '<option value="">Erro ao carregar</option>';
                modalCryptoMinBRL.textContent = 'Indisponível';
            }
        } catch (error) {
            console.error('Erro de conexão ao carregar criptomoedas:', error);
            cryptoCurrencySelect.innerHTML = '<option value="">Erro de conexão</option>';
            modalCryptoMinBRL.textContent = 'Indisponível';
        }
    }

    // Calcula e exibe o valor mínimo em BRL
    function updateMinAmountDisplay(selectedCryptoCode) { // Não precisa mais ser async
        const selectedCrypto = availableCryptos.find(c => c.code === selectedCryptoCode);
        if (!selectedCryptoCode || !selectedCrypto) {
            modalCryptoMinBRL.textContent = 'Selecione uma moeda';
            return;
        }

        // O min_amount e max_amount já vêm no objeto `crypto` da NOWPayments
        let minAmountCryptoUnit = parseFloat(selectedCrypto.min_amount);
        let maxAmountCryptoUnit = parseFloat(selectedCrypto.max_amount); // Também temos o máximo

        // Converte para BRL usando a taxa fixa (para demonstração)
        const minInBRL = minAmountCryptoUnit * USD_TO_BRL_RATE;
        const maxInBRL = maxAmountCryptoUnit * USD_TO_BRL_RATE;

        let minAmountText = `${minAmountCryptoUnit} ${selectedCryptoCode.toUpperCase()}`;
        minAmountText += ` (~ R$ ${minInBRL.toFixed(2).replace('.', ',')})`;

        // Opcional: Adicionar o máximo transacionável
        // minAmountText += ` - Máx: ${maxAmountCryptoUnit} ${selectedCryptoCode.toUpperCase()} (~ R$ ${maxInBRL.toFixed(2).replace('.', ',')})`;

        modalCryptoMinBRL.textContent = minAmountText;
    }


    // NOVO: Adicionar listener para o evento de 'change' no dropdown de criptomoedas
    cryptoCurrencySelect.addEventListener('change', function() {
        const selectedCryptoCode = cryptoCurrencySelect.value;
        updateMinAmountDisplay(selectedCryptoCode);
    });


    function returnToAddingProducts() {
        console.log('Voltando para Adicionar Produtos...');
        paymentArea.style.display = 'block'; // Reexibe a área de pagamento principal
        paymentDetailsDiv.innerHTML = '<p>Selecione a forma de pagamento desejada.</p>'; // NOVO: Mensagem inicial
        pdvState = 'ADDING_PRODUCTS'; // Reseta o estado
        focusBarcodeInput(); // Re-foca o input de código de barras
        paymentDetailsDiv.textContent = ''; // Limpa qualquer detalhe de pagamento
    }

    // --- Event Listeners ---

    // Foca o input de código de barras ao carregar e quando a janela é focada
    // window.addEventListener('focus', focusBarcodeInput);
    // focusBarcodeInput();
    checkLoginAndCashierStatus();

    btnOpenCashier.addEventListener('click', openCashierPrompt);
    btnCloseCashier.addEventListener('click', closeCashierPrompt);
    btnLogout.addEventListener('click', handleLogout);

    // Event Listeners para o Modal Abrir Caixa
    openCashierConfirmButton.addEventListener('click', confirmOpenCashier);
    openCashierCancelButton.addEventListener('click', closeOpenCashierModal);
    openCashierCloseButton.addEventListener('click', closeOpenCashierModal);

    // Event Listeners para o Modal Fechar Caixa
    closeCashierConfirmButton.addEventListener('click', confirmCloseCashier);
    closeCashierCancelButton.addEventListener('click', closeCloseCashierModal);
    closeCashierCloseButton.addEventListener('click', closeCloseCashierModal);

    // Evento de 'keydown' para o campo de código de barras (e simular scanner/enter)
    barcodeInput.addEventListener('keydown', function(event) {
        if (pdvState === 'ADDING_PRODUCTS' && event.key === 'Enter') {
            const productCode = barcodeInput.value.trim();
            if (productCode) {
                addProduct(productCode);
            }
            event.preventDefault();
        }
    });

    // Evento de clique para o botão "X" remover item
    productTableBody.addEventListener('click', function(event) {
        if (event.target.classList.contains('remove-item-btn')) {
            const index = parseInt(event.target.dataset.index);
            saleItems.splice(index, 1);
            updateProductList();
            focusBarcodeInput();
        }
    });

    // Evento de mudança para o input de quantidade de item
    productTableBody.addEventListener('change', function(event) {
        if (event.target.classList.contains('item-quantity-input')) {
            const index = parseInt(event.target.dataset.index);
            let newQuantity = parseFloat(event.target.value.replace(',', '.')); // Aceita vírgula e ponto
            if (isNaN(newQuantity) || newQuantity <= 0) {
                newQuantity = 0.001; // Garante uma quantidade mínima válida
                event.target.value = newQuantity;
            }
            saleItems[index].quantity = newQuantity;
            updateProductList();
            focusBarcodeInput();
        }
    });


    // Event Listeners para os botões de ação principal do PDV
    btnFinalizeSale.addEventListener('click', finalizeSale);
    btnCancelSale.addEventListener('click', cancelSale);
    btnApplyDiscount.addEventListener('click', applyDiscount);
    btnNewSale.addEventListener('click', startNewSale); // Listener para o botão Nova Venda


    // Event Listeners para o Modal de Quantidade/Peso
    modalConfirmButton.addEventListener('click', addProductFromModal);
    modalCancelButton.addEventListener('click', closeQuantityModal);
    modalCloseButton.addEventListener('click', closeQuantityModal);

    // Event Listeners para os botões de opção de pagamento
    paymentOptionsButtons.forEach(button => {
        button.addEventListener('click', function() {
            const option = parseInt(this.textContent.split(' ')[0]);
            if (!isNaN(option)) {
                handlePaymentSelection(option);
            }
        });
    });

    // Event Listeners para o Modal de Pagamento PIX
    modalCopyPixButton.addEventListener('click', function() {
        modalPixCopyPasteCode.select();
        document.execCommand('copy');
        alert('Código Pix Copia e Cola copiado!');
    });

    // ATENÇÃO: O botão de confirmação manual do PIX no modal está HIDDEN por padrão.
    // Se for reativá-lo, descomente o listener abaixo.
    // modalConfirmPixManually.addEventListener('click', async function() {
    //     const formaPagamento = 'PIX';
    //     const transacaoIdProvedor = modalPixTxid.textContent;
    //     stopPixPolling(); // Para o polling se confirmar manualmente
    //     await finalizeSaleBackend(formaPagamento, transacaoIdProvedor);
    //     // O modal PIX será fechado automaticamente pela finalizeSaleBackend se for sucesso
    // });

    modalCancelPix.addEventListener('click', closePixModal); // Botão "Cancelar PIX"
    pixCloseButton.addEventListener('click', closePixModal); // Botão 'x' do modal PIX

    modalCopyCryptoAddressButton.addEventListener('click', function() {
        modalCryptoAddress.select(); // Seleciona o textarea do endereço
        document.execCommand('copy');
        alert('Endereço Cripto copiado!');
    });

    // Listener de teclado para o modal de quantidade (Enter para confirmar, Esc para cancelar)
    quantityInputModal.addEventListener('keydown', function(event) {
        if (pdvState === 'QUANTITY_INPUT_MODE') {
            if (event.key === 'Enter') {
                addProductFromModal();
                event.preventDefault();
            } else if (event.key === 'Escape') {
                closeQuantityModal();
                event.preventDefault();
                event.stopPropagation();
            }
        }
    });

    btnGenerateCryptoPayment.addEventListener('click', generateCryptoPayment);

    // --- Captura de Atalhos de Teclado (Lógica Condicional para todos os estados) ---
    document.addEventListener('keydown', function(event) {
        // NOVO LOG: Mostra o estado, a tecla, e o elemento com foco no início de cada keydown
        console.log(`[KEYDOWN START] Key: '${event.key}', Code: '${event.code}', Ctrl: ${event.ctrlKey}, Alt: ${event.altKey}, Shift: ${event.shiftKey}, State: '${pdvState}', ActiveElement: ${document.activeElement.tagName} (${document.activeElement.id || 'Sem ID'})`);
        console.log(`[KEYDOWN START] event.defaultPrevented: ${event.defaultPrevented}, event.cancelable: ${event.cancelable}`);


        const currentStateAtKeydown = pdvState; // Captura o estado no início da execução

        if (currentStateAtKeydown === 'ADDING_PRODUCTS') {
            console.log("[KEYDOWN] Handling in ADDING_PRODUCTS mode.");
            if (event.ctrlKey && event.key === 'Enter') {
                finalizeSale();
                event.preventDefault();
                console.log("[ACTION] Finalizar Venda (Ctrl+Enter) triggered.");
            }
            if (event.ctrlKey && event.key === 'd') {
                applyDiscount();
                event.preventDefault();
                console.log("[ACTION] Aplicar Desconto (Ctrl+D) triggered.");
            }
            if (event.key === 'Escape') {
                cancelSale();
                event.preventDefault();
                event.stopPropagation();
                console.log("[ACTION] Cancelar Venda (Esc) triggered from ADDING_PRODUCTS.");
            }

        } else if (currentStateAtKeydown === 'PAYMENT_MODE') {
            console.log("[KEYDOWN] Handling in PAYMENT_MODE mode.");
            if (event.key >= '1' && event.key <= '4') {
                const option = parseInt(event.key);
                handlePaymentSelection(option);
                event.preventDefault();
                console.log(`[ACTION] Selecionar Pagamento (${option}) triggered.`);
            }
            if (event.key === 'Backspace') {
                returnToAddingProducts();
                event.preventDefault();
                console.log("[ACTION] Voltar Adicionar Produtos (Backspace) triggered.");
            }
            if (event.key === 'Escape') {
                cancelSale();
                event.preventDefault();
                event.stopPropagation();
                console.log("[ACTION] Cancelar Venda (Esc) triggered from PAYMENT_MODE.");
            }

        } else if (currentStateAtKeydown === 'QUANTITY_INPUT_MODE') {
            console.log("[KEYDOWN] Handling in QUANTITY_INPUT_MODE mode. (No generic preventDefault)");
            // A lógica de Enter/Esc é no listener específico do modal
        } else if (currentStateAtKeydown === 'PIX_MODAL_MODE') {
            console.log("[KEYDOWN] Handling in PIX_MODAL_MODE mode.");
            if (event.key === 'Enter') {
                modalConfirmPixManually.click();
                event.preventDefault();
                console.log("[ACTION] Confirmar PIX Manualmente (Enter) triggered.");
            } else if (event.key === 'Escape') {
                closePixModal();
                event.preventDefault();
                event.stopPropagation();
                console.log("[ACTION] Fechar Modal PIX (Esc) triggered.");
            } else if (event.key === 'c' && (event.ctrlKey || event.altKey)) {
                 modalCopyPixButton.click();
                 event.preventDefault();
                 console.log("[ACTION] Copiar PIX Code (Ctrl/Alt+C) triggered.");
            }
        } else if (currentStateAtKeydown === 'CRYPTO_MODAL_MODE') {
            console.log("[KEYDOWN] Handling in CRYPTO_MODAL_MODE mode.");
            console.log("[KEYDOWN] Handling in CRYPTO_MODAL_MODE mode.");
            if (event.key === 'Enter') {
                // Ao apertar Enter, acionar o botão "Gerar Pagamento Cripto"
                btnGenerateCryptoPayment.click(); // <<< CORREÇÃO AQUI
                event.preventDefault(); // Previne o comportamento padrão do Enter (como fechar o modal ou ativar algo no select)
                console.log("[ACTION] Gerar Pagamento Cripto (Enter) triggered.");
            } else if (event.key === 'Escape') {
                closeCryptoModal();
                event.preventDefault();
                event.stopPropagation();
                console.log("[ACTION] Fechar Modal Cripto (Esc) triggered.");
            } else if (event.key === 'a' && (event.ctrlKey || event.altKey)) {
                modalCopyCryptoAddressButton.click();
                event.preventDefault();
                console.log("[ACTION] Copiar Endereço Cripto (Ctrl/Alt+A) triggered.");
            }
        } else if (currentStateAtKeydown === 'OPEN_CASHIER_MODE') {
            console.log("[KEYDOWN] Handling in OPEN_CASHIER_MODE mode.");
            if (event.key === 'Enter') {
                openCashierConfirmButton.click();
                event.preventDefault();
            } else if (event.key === 'Escape') {
                closeOpenCashierModal();
                event.preventDefault();
                event.stopPropagation();
            }
        } else if (currentStateAtKeydown === 'CLOSE_CASHIER_MODE') {
            console.log("[KEYDOWN] Handling in CLOSE_CASHIER_MODE mode.");
            if (event.key === 'Enter') {
                closeCashierConfirmButton.click();
                event.preventDefault();
            } else if (event.key === 'Escape') {
                closeCloseCashierModal();
                event.preventDefault();
                event.stopPropagation();
            }
        } else if (currentStateAtKeydown === 'SALE_COMPLETED_MODE') {
            console.log("[KEYDOWN] Handling in SALE_COMPLETED_MODE mode.");
            if ((event.altKey && event.key === 'n') || event.key === 'Escape') {
                startNewSale();
                event.preventDefault();
                event.stopPropagation();
                console.log("[ACTION] Nova Venda (Alt+N / Esc) triggered.");
            }
            // Mantenha preventDefault/stopPropagation/return para SALE_COMPLETED_MODE, pois queremos bloquear tudo exceto Nova Venda
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        // --- Gerenciamento de Foco Geral ---
        if (currentStateAtKeydown === 'ADDING_PRODUCTS' && document.activeElement !== barcodeInput &&
            document.activeElement.tagName !== 'INPUT' &&
            document.activeElement.tagName !== 'BUTTON' &&
            document.activeElement.tagName !== 'SELECT' &&
            document.activeElement.tagName !== 'TEXTAREA') {
            focusBarcodeInput();
            console.log("[FOCUS] Foco retornado para barcodeInput.");
        }
    });

    // Inicializa a lista de produtos vazia ao carregar a página
    updateProductList();
    loadCryptocurrencies();
});