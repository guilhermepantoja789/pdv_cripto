// core/static/core/js/login.js

// Reutiliza a função getCookie de pdv.js para o CSRF token
// Em um projeto maior, esta função estaria em um arquivo utilitário compartilhado.
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
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('login-button');
    const loginMessage = document.getElementById('login-message');

    async function handleLogin() {
        loginMessage.textContent = ''; // Limpa mensagens anteriores
        loginMessage.classList.remove('error', 'success');

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            loginMessage.textContent = 'Por favor, preencha todos os campos.';
            loginMessage.classList.add('error');
            return;
        }

        try {
            const response = await fetch('/login/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({ username: username, password: password })
            });

            const responseData = await response.json();

            if (response.ok) {
                loginMessage.textContent = responseData.message;
                loginMessage.classList.add('success');
                // Redireciona para a página principal do PDV após login bem-sucedido
                window.location.href = '/vendas/pdv/';
            } else {
                loginMessage.textContent = responseData.error || 'Erro desconhecido no login.';
                loginMessage.classList.add('error');
            }
        } catch (error) {
            console.error('Erro de conexão:', error);
            loginMessage.textContent = 'Erro de conexão com o servidor.';
            loginMessage.classList.add('error');
        }
    }

    loginButton.addEventListener('click', handleLogin);

    // Permitir login com Enter nos campos de input
    usernameInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            handleLogin();
        }
    });
    passwordInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            handleLogin();
        }
    });

    // Focar o campo de usuário ao carregar a página
    usernameInput.focus();
});