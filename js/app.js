let FAQ = [];
let CATEGORIAS = [];
let sergioRequestId = 0;
const STORAGE_SERGIO = 'ossi-sergio-chat';
const historicoSergio = [];

function mostrar(secaoId) {
  document.querySelectorAll('.card').forEach((el) => el.classList.add('hidden'));
  document.getElementById(secaoId)?.classList.remove('hidden');
}

function renderFaq(lista, elId = 'faq-lista') {
  const wrap = document.getElementById(elId);
  wrap.innerHTML = lista.map((item) => `<article class="item-faq"><h4>${item.pergunta}</h4>${montarResposta(item).html}</article>`).join('');
}

function initNavegacao() {
  document.querySelectorAll('[data-target]').forEach((btn) => btn.addEventListener('click', () => mostrar(btn.dataset.target)));
}

function initCategorias() {
  const lista = document.getElementById('lista-categorias');
  lista.innerHTML = CATEGORIAS.map((cat) => `<button class="btn">${cat}</button>`).join('');
  [...lista.querySelectorAll('button')].forEach((btn) => btn.addEventListener('click', () => {
    document.getElementById('faq-titulo').textContent = btn.textContent;
    renderFaq(FAQ.filter((i) => i.categoria === btn.textContent));
    mostrar('faq');
  }));
}

function initBusca() {
  document.getElementById('btn-buscar').addEventListener('click', () => {
    const termo = document.getElementById('campo-busca').value;
    const res = filtrarFaq(FAQ, termo);
    const out = document.getElementById('resultado-busca');
    if (!res.length) {
      out.innerHTML = '<p>Nada encontrado. Tente outra palavra.</p>';
      return;
    }
    out.innerHTML = '<h3>Resultados</h3><div id="busca-lista"></div>';
    renderFaq(res.slice(0, 8), 'busca-lista');
  });
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
    const bloco = msg.respostaEstruturada ? montarResposta(msg.respostaEstruturada).html : `<div class="bloco-sergio"><p>${msg.content}</p></div>`;
    return `<div class="msg msg-assistant">${bloco}</div>`;
  }).join('');
  chat.scrollTop = chat.scrollHeight;
}

function initSergio() {
  const botao = document.getElementById('btn-sergio');
  const campo = document.getElementById('pergunta-sergio');
  const botaoLimpar = document.getElementById('btn-limpar-sergio');
  restaurarHistorico();
  renderChatSergio();

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
      historicoSergio.push({ role: 'assistant', content: respostaIA.respostaSimples, respostaEstruturada: respostaIA });
    } catch (_) {
      if (requestId !== sergioRequestId) return;
      historicoSergio.pop();
      const melhor = encontrarMelhorResposta(FAQ, pergunta);
      if (melhor) {
        historicoSergio.push({ role: 'assistant', content: melhor.respostaSimples, respostaEstruturada: melhor });
      } else {
        historicoSergio.push({ role: 'assistant', content: 'Modo local: na versão Vercel eu também uso IA. Tente explicar com mais detalhes.', respostaEstruturada: {
          respostaSimples: 'Modo local: na versão Vercel eu também uso IA. Tente explicar com mais detalhes.',
          passoAPasso: ['Escreva o nome do aplicativo.', 'Diga o que apareceu na tela.', 'Se houver risco, pare e peça ajuda.'],
          atencao: 'Não compartilhe dados pessoais.',
          quandoPedirAjuda: 'Peça ajuda se houver risco de golpe ou pedido de dinheiro.'
        } });
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
}

async function carregarDados() {
  FAQ = await fetch('data/faq.json').then((r) => r.json());
  CATEGORIAS = await fetch('data/categorias.json').then((r) => r.json());
}

async function init() {
  await carregarDados();
  initNavegacao();
  initCategorias();
  initBusca();
  initSergio();
}

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
init();
