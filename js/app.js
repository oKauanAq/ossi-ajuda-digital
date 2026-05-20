let FAQ = [];
let CATEGORIAS = [];

function mostrar(secaoId) {
  document.querySelectorAll('.card').forEach(el => el.classList.add('hidden'));
  document.getElementById(secaoId)?.classList.remove('hidden');
}

function renderFaq(lista) {
  const wrap = document.getElementById('faq-lista');
  wrap.innerHTML = lista.map(item => {
    const bloco = montarResposta(item);
    return `<article class="item-faq"><h4>${item.pergunta}</h4>${bloco.html}</article>`;
  }).join('');
}

function initNavegacao() {
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', () => mostrar(btn.dataset.target));
  });
}

function initCategorias() {
  const lista = document.getElementById('lista-categorias');
  lista.innerHTML = CATEGORIAS.map(cat => `<button class="btn">${cat}</button>`).join('');
  [...lista.querySelectorAll('button')].forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('faq-titulo').textContent = btn.textContent;
      renderFaq(FAQ.filter(i => i.categoria === btn.textContent));
      mostrar('faq');
    });
  });
}

function initBusca() {
  document.getElementById('btn-buscar').addEventListener('click', () => {
    const termo = document.getElementById('campo-busca').value;
    const res = filtrarFaq(FAQ, termo);
    const out = document.getElementById('resultado-busca');
    out.innerHTML = res.length ? '' : '<p>Nada encontrado. Tente outra palavra.</p>';
    if (res.length) {
      out.innerHTML = '<p>Resultados:</p>' + res.map(r => `<p>• ${r.pergunta}</p>`).join('');
    }
  });
}

function initSergio() {
  document.getElementById('btn-sergio').addEventListener('click', () => {
    const pergunta = document.getElementById('pergunta-sergio').value.trim();
    const saida = document.getElementById('resposta-sergio');
    if (!pergunta) return;
    const p = pergunta.toLowerCase();
    const melhor = FAQ.find(i => p.includes(i.categoria.toLowerCase()) || p.includes(i.pergunta.toLowerCase().slice(0, 12)));
    const resposta = melhor ? montarResposta(melhor) : respostaPadraoSegura();
    const alerta = ehSensivel(pergunta) ? '<p><strong>Segurança:</strong> Pare e peça ajuda de alguém de confiança.</p>' : '';
    saida.innerHTML = alerta + resposta.html;
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
}

init();
