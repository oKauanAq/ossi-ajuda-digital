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
    if (!res.length) {
      out.innerHTML = '<p>Nada encontrado. Tente outra palavra.</p>';
      return;
    }
    out.innerHTML = '<h3>Resultados</h3><div id="busca-lista"></div>';
    renderFaq(res.slice(0, 8), 'busca-lista');
  });
}

function initSergio() {
  document.getElementById('btn-sergio').addEventListener('click', async () => {
    const pergunta = document.getElementById('pergunta-sergio').value.trim();
    const saida = document.getElementById('resposta-sergio');
    if (!pergunta) return;
    const melhor = encontrarMelhorResposta(FAQ, pergunta);
    const respostaLocal = melhor ? montarResposta(melhor) : respostaPadraoSegura();

    if (deveBloquearIA(pergunta) || ehSensivel(pergunta)) {
      const alerta = '<p><strong>Segurança:</strong> Esse tema é sensível. Não compartilhe dados pessoais. Peça ajuda de alguém de confiança.</p>';
      saida.innerHTML = alerta + respostaLocal.html;
      return;
    }

    try {
      const respostaIA = await perguntarIA(pergunta);
      saida.innerHTML = `<div class="bloco-sergio"><p><strong>Resposta da IA (Vercel):</strong> ${respostaIA}</p></div>`;
    } catch (_) {
      saida.innerHTML = respostaLocal.html;
    }
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
