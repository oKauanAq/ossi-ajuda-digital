let FAQ = [];
let CATEGORIAS = [];
let sergioRequestId = 0;

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
  const botaoSergio = document.getElementById('btn-sergio');
  const campoPergunta = document.getElementById('pergunta-sergio');
  const saida = document.getElementById('resposta-sergio');

  const enviarPergunta = async () => {
    const pergunta = campoPergunta.value.trim();
    if (!pergunta) return;

    const requestId = ++sergioRequestId;
    saida.innerHTML = '<p>Estou pensando...</p>';
    botaoSergio.disabled = true;
    botaoSergio.textContent = 'Sérgio está pensando...';

    try {
      const respostaIA = await perguntarIA(pergunta);
      if (requestId === sergioRequestId) {
        saida.innerHTML = montarResposta(respostaIA).html;
      }
    } catch (_) {
      if (requestId !== sergioRequestId) return;
      const melhor = encontrarMelhorResposta(FAQ, pergunta);
      if (melhor) {
        saida.innerHTML = '<p>Modo local: na versão Vercel eu também uso IA. Aqui vou usar minha biblioteca de apoio.</p>' + montarResposta(melhor).html;
      } else {
        saida.innerHTML = '<p>Modo local: na versão Vercel eu também uso IA. Tente explicar com mais detalhes.</p>';
      }
    } finally {
      if (requestId === sergioRequestId) {
        botaoSergio.disabled = false;
        botaoSergio.textContent = 'Perguntar ao Sérgio';
      }
    }
  };

  botaoSergio.addEventListener('click', enviarPergunta);
  campoPergunta.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    enviarPergunta();
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
