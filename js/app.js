let FAQ = [];
let CATEGORIAS = [];
let sergioRequestId = 0;
const STORAGE_SERGIO = 'ossi-sergio-chat';
const historicoSergio = [];
let avatarSergio = '';

const OPCOES_RAPIDAS = [
  { label: '📱 Ajuda com celular', pergunta: 'Preciso de ajuda com meu celular.' },
  { label: '🟢 WhatsApp', pergunta: 'Estou com dúvida no WhatsApp.' },
  { label: '💳 Pix ou banco', pergunta: 'Tenho uma dúvida sobre Pix ou banco e quero fazer com segurança.' },
  { label: '🛡️ Acho que é golpe', pergunta: 'Acho que estou passando por um golpe. O que devo fazer?' },
  { label: '🔐 Senha ou conta', pergunta: 'Tenho uma dúvida sobre senha ou recuperação de conta.' },
  { label: '🛒 Verificar loja ou site', pergunta: 'Quero saber se uma loja ou site parece confiável.' },
  { label: '📝 Dúvida do dia a dia', pergunta: 'Tenho uma dúvida do dia a dia.' }
];

const DUVIDAS_COMUNS = ['Como aumentar o volume?', 'Como mandar mensagem no WhatsApp?', 'Recebi um link estranho.', 'Me pediram Pix urgente.', 'Esqueci minha senha.', 'Como saber se uma loja é confiável?', 'Como colocar foto no WhatsApp?'];

function mostrar(secaoId) { document.querySelectorAll('main .card[id]').forEach((el) => el.classList.add('hidden')); if (secaoId) document.getElementById(secaoId)?.classList.remove('hidden'); }
function renderFaq(lista, elId = 'faq-lista') { const wrap = document.getElementById(elId); wrap.innerHTML = lista.map((item) => `<article class="item-faq"><h4>${item.pergunta}</h4>${montarResposta(item).html}</article>`).join(''); }
function initNavegacao() { document.querySelectorAll('[data-target]').forEach((btn) => btn.addEventListener('click', () => mostrar(btn.dataset.target))); }

function initAcoesHome() {
  document.querySelectorAll('[data-chat-action="open"]').forEach((btn) => btn.addEventListener('click', () => abrirChat()));
  document.querySelectorAll('[data-chat-question]').forEach((btn) => btn.addEventListener('click', () => abrirChat(btn.dataset.chatQuestion || '')));
}

function initWidgetSergio() {
  const toggle = document.getElementById('sergio-widget-toggle');
  const fechar = document.getElementById('btn-fechar-sergio');
  toggle?.addEventListener('click', () => setChatAberto(document.getElementById('sergio-widget')?.classList.contains('hidden')));
  fechar?.addEventListener('click', () => setChatAberto(false));
  setChatAberto(false);
}
function initFaq() { const porCategoria = CATEGORIAS.flatMap((categoria) => FAQ.filter((item) => item.categoria === categoria)); renderFaq(porCategoria.length ? porCategoria : FAQ); }
function salvarHistorico() { localStorage.setItem(STORAGE_SERGIO, JSON.stringify(historicoSergio.slice(-30))); }
function restaurarHistorico() { const salvo = localStorage.getItem(STORAGE_SERGIO); if (!salvo) return; try { const itens = JSON.parse(salvo); if (!Array.isArray(itens)) return; historicoSergio.splice(0, historicoSergio.length, ...itens.filter((i) => i && ['user', 'assistant'].includes(i.role) && i.content)); } catch {} }
function renderChips(perguntas, classe = '') { return perguntas.map((item) => `<button type="button" class="chip-sergio ${classe}" data-question="${escaparHtml(item.pergunta || item)}">${escaparHtml(item.label || item)}</button>`).join(''); }


function setChatAberto(aberto) {
  const widget = document.getElementById('sergio-widget');
  const toggle = document.getElementById('sergio-widget-toggle');
  widget?.classList.toggle('hidden', !aberto);
  toggle?.setAttribute('aria-expanded', aberto ? 'true' : 'false');
}

function abrirChat(pergunta = '') {
  mostrar();
  setChatAberto(true);
  if (pergunta) window.enviarPerguntaSergioDireta?.(pergunta);
}
function initOpcoesRapidas() {
  document.getElementById('chips-assuntos').innerHTML = renderChips(OPCOES_RAPIDAS);
  document.getElementById('chips-duvidas').innerHTML = renderChips(DUVIDAS_COMUNS, 'secundario');
}
function fecharPaineisOpcoes() { document.getElementById('painel-assuntos')?.removeAttribute('open'); document.getElementById('painel-duvidas')?.removeAttribute('open'); }

function renderChatSergio() {
  const chat = document.getElementById('chat-sergio');
  if (!historicoSergio.length) { chat.innerHTML = '<div class="chat-boas-vindas"><p class="resposta-destaque">Conversa pronta para começar.</p></div>'; return; }
  chat.innerHTML = historicoSergio.map((msg) => {
    if (msg.role === 'user') return `<div class="msg msg-user"><p>${escaparHtml(msg.content)}</p></div>`;
    const bloco = msg.respostaEstruturada ? montarResposta(msg.respostaEstruturada, msg.contextoPergunta).html : `<div class="bloco-sergio"><p class="resposta-destaque">${escaparHtml(msg.content)}</p></div>`;
    const avatarHtml = avatarSergio ? `<img src="${avatarSergio}" class="sergio-avatar" alt="Avatar do Sérgio" />` : '👨‍🏫';
    return `<div class="msg msg-assistant"><span class="sergio-msg-avatar" aria-hidden="true">${avatarHtml}</span>${bloco}</div>`;
  }).join('');
  chat.scrollTop = chat.scrollHeight;
}

function initSergio() {
  const botao = document.getElementById('btn-sergio'); const campo = document.getElementById('pergunta-sergio'); const botaoLimpar = document.getElementById('btn-limpar-sergio'); const chat = document.getElementById('chat-sergio');
  restaurarHistorico(); renderChatSergio();
  const enviarPerguntaDireta = async (perguntaDireta) => { campo.value = perguntaDireta; await enviarPergunta(); };
  window.enviarPerguntaSergioDireta = enviarPerguntaDireta;
  const enviarPergunta = async () => {
    const pergunta = campo.value.trim(); if (!pergunta) return;
    const requestId = ++sergioRequestId; historicoSergio.push({ role: 'user', content: pergunta }); campo.value = ''; historicoSergio.push({ role: 'assistant', content: 'Sérgio está pensando...' }); renderChatSergio(); salvarHistorico();
    botao.disabled = true; botao.textContent = 'Sérgio está pensando...';
    try {
      const contexto = historicoSergio.filter((m) => m.role !== 'assistant' || m.content !== 'Sérgio está pensando...').slice(-6).map((m) => ({ role: m.role, content: m.content }));
      const respostaIA = await perguntarIA(pergunta, contexto); if (requestId !== sergioRequestId) return;
      historicoSergio.pop(); historicoSergio.push({ role: 'assistant', content: respostaIA.respostaSimples, respostaEstruturada: respostaIA, contextoPergunta: pergunta });
    } catch (_) {
      if (requestId !== sergioRequestId) return; historicoSergio.pop();
      const melhor = encontrarMelhorResposta(FAQ, pergunta);
      historicoSergio.push(melhor ? { role: 'assistant', content: melhor.respostaSimples, respostaEstruturada: melhor, contextoPergunta: pergunta } : { role: 'assistant', content: 'Modo local: na versão Vercel eu também uso IA. Tente explicar com mais detalhes.' });
    } finally { if (requestId === sergioRequestId) { botao.disabled = false; botao.textContent = 'Enviar'; renderChatSergio(); salvarHistorico(); } }
  };
  botao.addEventListener('click', enviarPergunta);
  campo.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); enviarPergunta(); } });
  document.getElementById('sergio-widget').addEventListener('click', (event) => { const target = event.target.closest('[data-question]'); if (!target) return; fecharPaineisOpcoes(); enviarPerguntaDireta(target.dataset.question || ''); });
  botaoLimpar.addEventListener('click', () => { historicoSergio.splice(0, historicoSergio.length); localStorage.removeItem(STORAGE_SERGIO); renderChatSergio(); });
}

async function configurarAvatarSergio() { try { const caminhoAvatar = 'assets/sergio-avatar.png'; const resp = await fetch(caminhoAvatar, { method: 'HEAD' }); if (!resp.ok) throw new Error(); avatarSergio = caminhoAvatar; document.querySelectorAll('.sergio-avatar').forEach((img) => { img.src = caminhoAvatar; img.classList.remove('hidden'); }); document.querySelectorAll('.avatar-fallback').forEach((el) => el.classList.add('hidden')); } catch (_) {} }
async function carregarDados() { FAQ = await fetch('data/faq.json').then((r) => r.json()); CATEGORIAS = await fetch('data/categorias.json').then((r) => r.json()); }
async function init() { await carregarDados(); await configurarAvatarSergio(); initNavegacao(); initAcoesHome(); initWidgetSergio(); initFaq(); initOpcoesRapidas(); initSergio(); }

if ('serviceWorker' in navigator) window.addEventListener('load', async () => { const reg = await navigator.serviceWorker.register('service-worker.js'); reg.addEventListener('updatefound', () => document.getElementById('sw-update-msg')?.classList.remove('hidden')); });
init();
