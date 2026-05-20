let FAQ = [];
let CATEGORIAS = [];

function mostrar(secaoId) {
  document.querySelectorAll('.card').forEach(el => el.classList.add('hidden'));
  document.getElementById(secaoId)?.classList.remove('hidden');
}

function renderFaq(lista, elId='faq-lista') {
  const wrap = document.getElementById(elId);
  wrap.innerHTML = lista.map(item => `<article class="item-faq"><h4>${item.pergunta}</h4>${montarResposta(item).html}</article>`).join('');
}

function respostaDeFallbackPorFaq(pergunta) {
  const melhor = encontrarMelhorResposta(FAQ, pergunta);
  return melhor ? montarResposta(melhor) : respostaPadraoSegura();
}

function initNavegacao() {
  document.querySelectorAll('[data-target]').forEach(btn => btn.addEventListener('click', () => mostrar(btn.dataset.target)));
}

function initCategorias() {
  const lista = document.getElementById('lista-categorias');
  lista.innerHTML = CATEGORIAS.map(cat => `<button class="btn">${cat}</button>`).join('');
  [...lista.querySelectorAll('button')].forEach(btn => btn.addEventListener('click', () => {
    document.getElementById('faq-titulo').textContent = btn.textContent;
    renderFaq(FAQ.filter(i => i.categoria === btn.textContent));
    mostrar('faq');
  }));
}

function initBusca() {
  document.getElementById('btn-buscar').addEventListener('click', () => {
    const termo = document.getElementById('campo-busca').value;
    const res = filtrarFaq(FAQ, termo);
    const out = document.getElementById('resultado-busca');
    if (!res.length) return out.innerHTML = '<p>Nada encontrado. Tente outra palavra.</p>';
    out.innerHTML = '<h3>Resultados</h3><div id="busca-lista"></div>';
    renderFaq(res.slice(0, 8), 'busca-lista');
  });
}

async function responderSergio(pergunta) {
  if (ehSensivel(pergunta)) return { aviso: '', bloco: respostaPadraoSegura() };

  const emVercel = location.hostname.endsWith('.vercel.app') || location.hostname === 'localhost';
  if (emVercel && typeof consultarSergioIA === 'function') {
    const ia = await consultarSergioIA(pergunta);
    if (ia.ok && ia.resposta && ia.resposta.respostaSimples && Array.isArray(ia.resposta.passoAPasso)) {
      return { aviso: '', bloco: montarResposta(ia.resposta) };
    }
    const local = respostaDeFallbackPorFaq(pergunta);
    return { aviso: '<p><strong>Sérgio:</strong> Vou responder com minha biblioteca segura de dúvidas.</p>', bloco: local };
  }

  return { aviso: '<p><strong>Sérgio:</strong> Vou responder com minha biblioteca segura de dúvidas.</p>', bloco: respostaDeFallbackPorFaq(pergunta) };
}

function initSergio() {
  document.getElementById('btn-sergio').addEventListener('click', async () => {
    const pergunta = document.getElementById('pergunta-sergio').value.trim();
    const saida = document.getElementById('resposta-sergio');
    if (!pergunta) return;
    const alerta = ehSensivel(pergunta) ? '<p><strong>Segurança:</strong> Pare antes de continuar e peça ajuda a uma pessoa de confiança ou responsável da OSSI.</p>' : '';
    const resposta = await responderSergio(pergunta);
    saida.innerHTML = alerta + resposta.aviso + resposta.bloco.html;
  });
}

async function carregarDados() {
  FAQ = await fetch('data/faq.json').then(r => r.json());
  CATEGORIAS = await fetch('data/categorias.json').then(r => r.json());
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
