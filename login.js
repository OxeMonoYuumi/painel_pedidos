// Configurações do Supabase (Mesmas chaves do script.js)
const supabaseUrl = 'https://pauzygjodxkwcwzkiikd.supabase.co';
const supabaseKey = 'sb_publishable_pGiSZG8QT8cFgOi-9L5gPg_vMSXr0Ks';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const authError = document.getElementById('auth-error');
    const authSuccess = document.getElementById('auth-success');

    // Verificar se já está logado
    checkSession();

    async function checkSession() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            window.location.href = 'index.html';
        }
    }

    function showMessage(element, message, isError = true) {
        element.textContent = message;
        element.classList.remove('hidden');
        if (isError) {
            authSuccess.classList.add('hidden');
        } else {
            authError.classList.add('hidden');
        }
    }

    function hideMessages() {
        authError.classList.add('hidden');
        authSuccess.classList.add('hidden');
    }

    function setLoading(button, isLoading, text) {
        button.textContent = text;
        button.disabled = isLoading;
        btnLogin.disabled = isLoading;
        btnRegister.disabled = isLoading;
    }

    // Ação de Login (Submit do form)
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessages();
        setLoading(btnLogin, true, 'Entrando...');

        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            // Login com sucesso
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Erro no login:', error);
            showMessage(authError, error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
        } finally {
            setLoading(btnLogin, false, 'Entrar');
        }
    });

    // Ação de Registro
    btnRegister.addEventListener('click', async () => {
        if (!loginForm.checkValidity()) {
            loginForm.reportValidity();
            return;
        }

        hideMessages();
        setLoading(btnRegister, true, 'Criando...');

        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
            });

            if (error) throw error;

            if (data.user && data.session) {
                // Registro concluído e logado automaticamente
                window.location.href = 'index.html';
            } else {
                // Necessário confirmação de e-mail
                showMessage(authSuccess, 'Conta criada! Verifique seu e-mail para confirmar (se exigido no painel).', false);
            }
        } catch (error) {
            console.error('Erro no registro:', error);
            showMessage(authError, error.message);
        } finally {
            setLoading(btnRegister, false, 'Criar conta');
        }
    });
});
