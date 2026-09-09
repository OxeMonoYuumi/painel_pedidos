// Configurações do Supabase
const supabaseUrl = 'https://pauzygjodxkwcwzkiikd.supabase.co';
const supabaseKey = 'sb_publishable_pGiSZG8QT8cFgOi-9L5gPg_vMSXr0Ks';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Estado da Aplicação
let pedidos = [];
let setoresAtuais = new Set();
let setorSelecionado = 'Todos';
let usuarioAtualId = null;

// Elementos do DOM
const ordersGrid = document.getElementById('orders-grid');
const filterButtonsContainer = document.getElementById('filter-buttons');
const loadingSpinner = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');

// Elementos do Modal e Formulário
const btnNovoPedido = document.getElementById('btn-novo-pedido');
const modalNovoPedido = document.getElementById('modal-novo-pedido');
const btnFecharModal = document.getElementById('btn-fechar-modal');
const btnCancelar = document.getElementById('btn-cancelar');
const formNovoPedido = document.getElementById('form-novo-pedido');
const statusSummary = document.getElementById('status-summary');
const btnAtendente = document.getElementById('btn-atendente');
const modalAtendente = document.getElementById('modal-atendente');
const assistantMessages = document.getElementById('assistant-messages');
const assistantForm = document.getElementById('assistant-form');
const assistantInput = document.getElementById('assistant-input');
const assistantSubmit = document.getElementById('assistant-submit');
let conversaAtendente = [];

// Inicialização
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    usuarioAtualId = session.user.id;

    configurarEventos();
    await fetchPedidos();
    renderizarDados();
}

// Buscar Pedidos do Supabase
async function fetchPedidos() {
    try {
        mostrarLoading(true);

        const { data, error } = await supabaseClient
            .from('pedidos')
            .select('*')
            .eq('user_id', usuarioAtualId)
            .order('criado_em', { ascending: false });

        if (error) throw error;

        pedidos = data;

    } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
        mostrarErro(true);
    } finally {
        mostrarLoading(false);
    }
}

// Configurar Eventos do Modal e Formulário
function configurarEventos() {
    btnAtendente.addEventListener('click', abrirAtendente);

    document.getElementById('btn-fechar-atendente').addEventListener('click', fecharAtendente);
    modalAtendente.addEventListener('click', (e) => {
        if (e.target === modalAtendente) fecharAtendente();
    });
    assistantForm.addEventListener('submit', enviarMensagemAtendente);

    btnNovoPedido.addEventListener('click', () => {
        formNovoPedido.reset();
        document.getElementById('pedido_id').value = '';
        document.querySelector('#modal-novo-pedido h2').textContent = 'Novo Pedido';
        modalNovoPedido.classList.remove('hidden');
    });

    const fecharModal = () => {
        modalNovoPedido.classList.add('hidden');
        formNovoPedido.reset();
        document.getElementById('pedido_id').value = '';
        document.querySelector('#modal-novo-pedido h2').textContent = 'Novo Pedido';
    };

    btnFecharModal.addEventListener('click', fecharModal);
    btnCancelar.addEventListener('click', fecharModal);

    // Fechar ao clicar fora
    modalNovoPedido.addEventListener('click', (e) => {
        if (e.target === modalNovoPedido) fecharModal();
    });

    // Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.href = 'login.html';
        });
    }

    // Submit do formulário
    formNovoPedido.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('pedido_id').value;
        const dadosPedido = {
            user_id: usuarioAtualId,
            cliente: document.getElementById('cliente').value,
            telefone: document.getElementById('telefone').value,
            setor: document.getElementById('setor').value,
            servico: document.getElementById('servico').value,
            valor: parseFloat(document.getElementById('valor').value),
            data_pedido: document.getElementById('data_pedido').value,
            status: document.getElementById('status').value,
            observacoes: document.getElementById('observacoes').value,
        };

        try {
            const btnSalvar = document.getElementById('btn-salvar-pedido');
            btnSalvar.textContent = 'Salvando...';
            btnSalvar.disabled = true;

            let error;
            if (id) {
                const res = await supabaseClient
                    .from('pedidos')
                    .update(dadosPedido)
                    .eq('id', id)
                    .eq('user_id', usuarioAtualId);
                error = res.error;
            } else {
                const res = await supabaseClient.from('pedidos').insert([dadosPedido]);
                error = res.error;
            }

            if (error) throw error;

            fecharModal();
            await fetchPedidos();
            renderizarDados();

        } catch (err) {
            console.error('Erro ao salvar pedido:', err);
            alert('Erro ao salvar o pedido. Verifique os dados e tente novamente.');
        } finally {
            const btnSalvar = document.getElementById('btn-salvar-pedido');
            btnSalvar.textContent = 'Salvar Pedido';
            btnSalvar.disabled = false;
        }
    });
}

function abrirAtendente() {
    conversaAtendente = [];
    assistantMessages.innerHTML = '';
    adicionarMensagem('assistant', 'Olá! Vou ajudar a registrar seu pedido. Pode me informar os detalhes?');
    modalAtendente.classList.remove('hidden');
    assistantInput.focus();
}

function fecharAtendente() {
    modalAtendente.classList.add('hidden');
    assistantInput.value = '';
}

function adicionarMensagem(role, content) {
    conversaAtendente.push({ role, content });
    const message = document.createElement('p');
    message.className = `assistant-message ${role}`;
    message.textContent = content;
    assistantMessages.appendChild(message);
    assistantMessages.scrollTop = assistantMessages.scrollHeight;
}

async function enviarMensagemAtendente(event) {
    event.preventDefault();
    const content = assistantInput.value.trim();
    if (!content || assistantSubmit.disabled) return;

    adicionarMensagem('user', content);
    assistantInput.value = '';
    assistantInput.disabled = true;
    assistantSubmit.disabled = true;
    assistantSubmit.textContent = 'Enviando...';

    try {
        const { data, error } = await supabaseClient.functions.invoke('atendente', {
            body: { messages: conversaAtendente }
        });
        if (error) throw error;
        if (!data || data.error) throw new Error(data?.error || 'Não foi possível processar a mensagem.');

        adicionarMensagem('assistant', data.message || 'Pode me passar mais detalhes do pedido?');
        if (data.saved) {
            adicionarMensagem('assistant', 'O pedido foi salvo com sucesso.');
            await fetchPedidos();
            renderizarDados();
        }
    } catch (error) {
        console.error('Erro no atendente virtual:', error);
        const errorMessage = await obterMensagemErroAtendente(error);
        adicionarMensagem('assistant', errorMessage);
    } finally {
        assistantInput.disabled = false;
        assistantSubmit.disabled = false;
        assistantSubmit.textContent = 'Enviar';
        assistantInput.focus();
    }
}

async function obterMensagemErroAtendente(error) {
    try {
        const response = error?.context;
        if (response && typeof response.clone === 'function') {
            const body = await response.clone().json();
            if (body?.error) return body.error;
        }
    } catch (contextError) {
        console.warn('Não foi possível ler o erro da Edge Function:', contextError);
    }

    return error?.message || 'Não consegui processar o pedido agora. Tente novamente.';
}

function renderizarDados() {
    extrairSetores();
    renderizarFiltros();
    renderizarPedidos();
}

// Lógica de Filtros
function extrairSetores() {
    setoresAtuais.clear();
    pedidos.forEach(pedido => {
        if (pedido.setor) {
            setoresAtuais.add(pedido.setor);
        }
    });
}

function renderizarFiltros() {
    filterButtonsContainer.innerHTML = '';

    // Botão "Todos"
    const btnTodos = criarBotaoFiltro('Todos', setorSelecionado === 'Todos');
    filterButtonsContainer.appendChild(btnTodos);

    // Botões dos Setores
    const setoresArray = Array.from(setoresAtuais).sort();
    setoresArray.forEach(setor => {
        const btn = criarBotaoFiltro(setor, setorSelecionado === setor);
        filterButtonsContainer.appendChild(btn);
    });
}

function criarBotaoFiltro(setor, isActive) {
    const button = document.createElement('button');
    button.className = `filter-btn ${isActive ? 'active' : ''}`;
    button.textContent = setor;
    button.addEventListener('click', () => {
        setorSelecionado = setor;
        renderizarFiltros(); // Atualiza a classe active
        renderizarPedidos(); // Filtra e renderiza os cards
    });
    return button;
}

// Renderização dos Cards
function renderizarPedidos() {
    ordersGrid.innerHTML = '';

    const pedidosFiltrados = setorSelecionado === 'Todos'
        ? pedidos
        : pedidos.filter(p => p.setor === setorSelecionado);

    renderizarResumo(pedidosFiltrados);

    if (pedidosFiltrados.length === 0) {
        ordersGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">Nenhum pedido encontrado para este setor.</p>';
        return;
    }

    pedidosFiltrados.forEach((pedido, index) => {
        const card = criarCardPedido(pedido, index);
        ordersGrid.appendChild(card);
    });
}

function criarCardPedido(pedido, index) {
    const div = document.createElement('div');
    div.className = 'order-card';

    // Animação em cascata (delay baseado no índice)
    div.style.animationDelay = `${index * 0.05}s`;

    // Formatação de Valores
    const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.valor || 0);

    // Formatação da classe de status
    const statusClass = pedido.status ? `status-${pedido.status.toLowerCase().replace(' ', '-')}` : 'status-default';
    const statusText = pedido.status || 'Sem status';

    // Formatação da Data (criado_em)
    let dataFormatada = pedido.data_pedido || '';
    if (!dataFormatada && pedido.criado_em) {
        const dataObj = new Date(pedido.criado_em);
        dataFormatada = new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(dataObj);
    }

    div.innerHTML = `
        <div class="card-header">
            <div class="client-info">
                <h2>${escapeHtml(pedido.cliente || 'Cliente não informado')}</h2>
                <p>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    ${escapeHtml(pedido.telefone || 'Sem telefone')}
                </p>
            </div>
            <span class="status-badge ${statusClass}">${escapeHtml(statusText)}</span>
        </div>
        
        <div class="card-body">
            <div class="info-row">
                <span class="info-label">ID do Pedido</span>
                <span class="info-value">#${pedido.id || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Serviço/Produto</span>
                <span class="info-value">${escapeHtml(pedido.servico || 'Não especificado')}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Data</span>
                <span class="info-value">${escapeHtml(dataFormatada)}</span>
            </div>
            <div class="info-row" style="margin-top: 0.5rem; border-top: 1px dashed var(--card-border); padding-top: 0.75rem;">
                <span class="info-label">Valor Total</span>
                <span class="info-value price">${valorFormatado}</span>
            </div>
        </div>
        
        <div class="card-footer">
            ${pedido.observacoes ? `<p><strong>Obs:</strong> ${escapeHtml(pedido.observacoes)}</p>` : ''}
            <span class="sector-chip">${escapeHtml(pedido.setor || 'Outro')}</span>
            <div class="card-actions" style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: flex-end; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 0.5rem;">
                <button class="btn-icon btn-edit" onclick="window.editarPedido('${pedido.id}')" title="Editar">✏️ Editar</button>
                <button class="btn-icon btn-delete" onclick="window.deletarPedido('${pedido.id}')" title="Excluir">🗑️ Excluir</button>
            </div>
        </div>
    `;

    return div;
}

// Resumo dos Status
function renderizarResumo(pedidosFiltrados) {
    const total = pedidosFiltrados.length;
    const pendentes = pedidosFiltrados.filter(p => p.status === 'Pendente').length;
    const emProducao = pedidosFiltrados.filter(p => p.status === 'Em produção' || p.status === 'Em produo').length;
    const confirmados = pedidosFiltrados.filter(p => p.status === 'Confirmado').length;
    const cancelados = pedidosFiltrados.filter(p => p.status === 'Cancelado').length;

    statusSummary.innerHTML = `
        <div class="summary-card">
            <span>Total</span>
            <strong>${total}</strong>
        </div>
        <div class="summary-card" style="border-bottom: 3px solid var(--status-pendente-text)">
            <span>Pendentes</span>
            <strong>${pendentes}</strong>
        </div>
        <div class="summary-card" style="border-bottom: 3px solid #0284c7">
            <span>Em produção</span>
            <strong style="color: #0284c7">${emProducao}</strong>
        </div>
        <div class="summary-card" style="border-bottom: 3px solid var(--status-confirmado-text)">
            <span>Confirmados</span>
            <strong>${confirmados}</strong>
        </div>
        <div class="summary-card" style="border-bottom: 3px solid var(--status-cancelado-text)">
            <span>Cancelados</span>
            <strong>${cancelados}</strong>
        </div>
    `;
}

// Utilitários
function mostrarLoading(show) {
    if (show) {
        loadingSpinner.classList.remove('hidden');
        ordersGrid.classList.add('hidden');
    } else {
        loadingSpinner.classList.add('hidden');
        ordersGrid.classList.remove('hidden');
    }
}

function mostrarErro(show) {
    if (show) {
        errorMessage.classList.remove('hidden');
        ordersGrid.classList.add('hidden');
    } else {
        errorMessage.classList.add('hidden');
    }
}

// Evitar XSS básico
function escapeHtml(unsafe) {
    if (!unsafe && unsafe !== 0) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.deletarPedido = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este pedido?')) return;
    
    try {
        mostrarLoading(true);
        const { error } = await supabaseClient
            .from('pedidos')
            .delete()
            .eq('id', id)
            .eq('user_id', usuarioAtualId);
        if (error) throw error;
        
        await fetchPedidos();
        renderizarDados();
    } catch (error) {
        console.error('Erro ao deletar pedido:', error);
        alert('Erro ao excluir pedido.');
    } finally {
        mostrarLoading(false);
    }
};

window.editarPedido = (id) => {
    const pedido = pedidos.find(p => String(p.id) === String(id));
    if (!pedido) return;
    
    document.getElementById('pedido_id').value = pedido.id;
    document.getElementById('cliente').value = pedido.cliente || '';
    document.getElementById('telefone').value = pedido.telefone || '';
    document.getElementById('setor').value = pedido.setor || '';
    document.getElementById('servico').value = pedido.servico || '';
    document.getElementById('valor').value = pedido.valor || '';
    document.getElementById('data_pedido').value = pedido.data_pedido || '';
    document.getElementById('status').value = pedido.status || 'Pendente';
    document.getElementById('observacoes').value = pedido.observacoes || '';
    
    document.querySelector('#modal-novo-pedido h2').textContent = 'Editar Pedido';
    modalNovoPedido.classList.remove('hidden');
};
