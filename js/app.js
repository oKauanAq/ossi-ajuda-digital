let FAQ = [];
let CATEGORIAS = [];
let sergioRequestId = 0;
const STORAGE_SERGIO = 'ossi-sergio-chat';
const historicoSergio = [];

function mostrar(secaoId) {
  document.querySelectorAll('main .card').forEach((el) => {
    if (el.id) el.classList.add('hidden');
  });
  if (secaoId) document.getElementById(secaoId)?.classList.remove('hidden');
}

function renderFaq(lista, elId = 'faq-lista') {
  const wrap = document.getElementById(elId);
  wrap.innerHTML = lista.map((item) => `<article class="item-faq"><h4>${item.pergunta}</h4>${montarResposta(item).html}</article>`).join('');
}

function initNavegacao() {
  document.querySelectorAll('[data-target]').forEach((btn) => btn.addEventListener('click', () => mostrar(btn.dataset.target)));
}

function initFaq() {
  const porCategoria = CATEGORIAS.flatMap((categoria) => FAQ.filter((item) => item.categoria === categoria));
  renderFaq(porCategoria.length ? porCategoria : FAQ);
}

function salvarHistorico() { localStorage.setItem(STORAGE_SERGIO, JSON.stringify(historicoSergio.slice(-30))); }
function restaurarHistorico() {
  const salvo = localStorage.getItem(STORAGE_SERGIO);
  if (!salvo) return;
  try {
    const itens = JSON.parse(salvo);
    if (!Array.isArray(itens)) return;
    historicoSergio.splice(0, historicoSergio.length, ...itens.filter((i) => i && ['user', 'assistant'].includes(i.role) && i.content));
  } catch {}
}

function renderChatSergio() {
  const chat = document.getElementById('chat-sergio');
  chat.innerHTML = historicoSergio.map((msg) => {
    if (msg.role === 'user') return `<div class="msg msg-user"><p>${msg.content}</p></div>`;
    const bloco = msg.respostaEstruturada ? montarResposta(msg.respostaEstruturada, msg.contextoPergunta).html : `<div class="bloco-sergio"><p class="resposta-destaque">${msg.content}</p></div>`;
    return `<div class="msg msg-assistant">${bloco}</div>`;
  }).join('');
  chat.scrollTop = chat.scrollHeight;
}

function initWidgetSergio() {
  const toggle = document.getElementById('sergio-widget-toggle');
  const widget = document.getElementById('sergio-widget');
  const closeBtn = document.getElementById('sergio-widget-close');

  const alternarWidget = (abrir = null) => {
    const abrirAgora = abrir !== null ? abrir : widget.classList.contains('hidden');
    widget.classList.toggle('hidden', !abrirAgora);
    if (abrirAgora) document.getElementById('pergunta-sergio')?.focus();
  };

  toggle.addEventListener('click', () => alternarWidget());
  closeBtn.addEventListener('click', () => alternarWidget(false));

  return { alternarWidget };
}

function initSergio(widgetApi) {
  const botao = document.getElementById('btn-sergio');
  const campo = document.getElementById('pergunta-sergio');
  const botaoLimpar = document.getElementById('btn-limpar-sergio');

  restaurarHistorico();
  renderChatSergio();
  initMicrofone(campo);

  const enviarPergunta = async () => {
    const pergunta = campo.value.trim();
    if (!pergunta) return;
    const requestId = ++sergioRequestId;
    historicoSergio.push({ role: 'user', content: pergunta });
    campo.value = '';
    historicoSergio.push({ role: 'assistant', content: 'Sérgio está pensando...' });
    renderChatSergio();
    salvarHistorico();

    botao.disabled = true;
    botao.textContent = 'Sérgio está pensando...';

    try {
      const contexto = historicoSergio.filter((m) => m.role !== 'assistant' || m.content !== 'Sérgio está pensando...').slice(-6).map((m) => ({ role: m.role, content: m.content }));
      const respostaIA = await perguntarIA(pergunta, contexto);
      if (requestId !== sergioRequestId) return;
      historicoSergio.pop();
      historicoSergio.push({ role: 'assistant', content: respostaIA.respostaSimples, respostaEstruturada: respostaIA, contextoPergunta: pergunta });
    } catch (_) {
      if (requestId !== sergioRequestId) return;
      historicoSergio.pop();
      const melhor = encontrarMelhorResposta(FAQ, pergunta);
      if (melhor) {
        historicoSergio.push({ role: 'assistant', content: melhor.respostaSimples, respostaEstruturada: melhor, contextoPergunta: pergunta });
      } else {
        historicoSergio.push({ role: 'assistant', content: 'Modo local: na versão Vercel eu também uso IA. Tente explicar com mais detalhes.', respostaEstruturada: {
          respostaSimples: 'Modo local: na versão Vercel eu também uso IA. Tente explicar com mais detalhes.',
          passoAPasso: ['Escreva o nome do aplicativo.', 'Diga o que apareceu na tela.', 'Se houver risco, pare e peça ajuda.'],
          atencao: 'Não compartilhe dados pessoais.',
          quandoPedirAjuda: 'Peça ajuda se houver risco de golpe ou pedido de dinheiro.'
        }, contextoPergunta: pergunta });
      }
    } finally {
      if (requestId === sergioRequestId) {
        botao.disabled = false;
        botao.textContent = 'Enviar';
        renderChatSergio();
        salvarHistorico();
      }
    }
  };

  botao.addEventListener('click', enviarPergunta);
  campo.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      enviarPergunta();
    }
  });

  botaoLimpar.addEventListener('click', () => {
    historicoSergio.splice(0, historicoSergio.length);
    localStorage.removeItem(STORAGE_SERGIO);
    renderChatSergio();
  });

  document.querySelectorAll('[data-action="abrir-chat"]').forEach((btn) => btn.addEventListener('click', () => widgetApi.alternarWidget(true)));
  document.querySelectorAll('[data-action="pergunta-rapida"]').forEach((btn) => btn.addEventListener('click', () => {
    widgetApi.alternarWidget(true);
    campo.value = btn.dataset.question || '';
    campo.focus();
  }));
}

async function carregarDados() {
  FAQ = await fetch('data/faq.json').then((r) => r.json());
  CATEGORIAS = await fetch('data/categorias.json').then((r) => r.json());
}

async function init() {
  await carregarDados();
  initNavegacao();
  initFaq();
  const widgetApi = initWidgetSergio();
  initSergio(widgetApi);
}

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
init();
