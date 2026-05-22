let FAQ = [];
let CATEGORIAS = [];
let sergioRequestId = 0;
const STORAGE_SERGIO = 'ossi-sergio-chat';

const STORAGE_AVALIACAO = 'ossi-avaliacao-local';
let avaliacaoSelecionada = '';

function initAvaliacao() {
  const opcoes = document.querySelectorAll('.avaliacao-opcao');
  const botaoSalvar = document.getElementById('salvar-avaliacao');
  const sugestao = document.getElementById('avaliacao-sugestao');
  const status = document.getElementById('avaliacao-status');

  opcoes.forEach((opcao) => opcao.addEventListener('click', () => {
    avaliacaoSelecionada = opcao.dataset.avaliacao || '';
    opcoes.forEach((item) => item.setAttribute('aria-pressed', item === opcao ? 'true' : 'false'));
    if (status) status.textContent = '';
  }));

  botaoSalvar?.addEventListener('click', () => {
    if (!avaliacaoSelecionada) {
      status.textContent = 'Escolha uma opção de avaliação antes de salvar.';
      return;
    }
    const payload = {
      avaliacao: avaliacaoSelecionada,
      sugestao: (sugestao?.value || '').trim(),
      salvoEm: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_AVALIACAO, JSON.stringify(payload));
    status.textContent = 'Obrigado! Sua avaliação ficou registrada neste aparelho.';
  });
}

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


const FLUXOS_GUIADOS = {
  celular: { usuario: 'Ajuda com celular', resposta: 'Claro! Posso ajudar com o celular. Escolha uma opção abaixo ou escreva sua dúvida.', opcoes: ['Como aumentar o volume?', 'Como conectar no Wi-Fi?', 'Como tirar print?', 'Meu celular está sem som.', 'Quero escrever minha dúvida.'] },
  whatsapp: { usuario: 'Dúvida no WhatsApp', resposta: 'Posso ajudar com o WhatsApp. Escolha uma opção ou escreva sua dúvida.', opcoes: ['Como mandar mensagem no WhatsApp?', 'Como colocar foto no WhatsApp?', 'Recebi um link estranho no WhatsApp.', 'Alguém pediu dinheiro no WhatsApp.', 'Quero escrever minha dúvida.'] },
  pix_banco: { usuario: 'Banco e Pix com segurança', resposta: 'Vamos falar de banco e Pix com cuidado. Escolha uma opção antes de fazer qualquer pagamento.', opcoes: ['Como fazer Pix?', 'Me pediram Pix urgente.', 'Como saber se é golpe?', 'Quero verificar uma loja ou site.', 'Quero escrever minha dúvida.'] },
  golpe: { usuario: 'Estou com medo de golpe', resposta: 'Vamos com calma. Se você acha que é golpe, não clique em nada e não envie dinheiro.', opcoes: ['Recebi um link estranho.', 'Número desconhecido me chamou.', 'Estão usando foto de familiar.', 'Me pediram Pix urgente.', 'Quero escrever o que aconteceu.'] },
  senha_conta: { usuario: 'Senha ou conta', resposta: 'Posso ajudar com conta e senha. Nunca envie sua senha ou código para ninguém.', opcoes: ['Esqueci minha senha.', 'Não consigo entrar no Facebook.', 'Minha conta foi bloqueada.', 'Recebi código no celular.', 'Quero escrever minha dúvida.'] },
  loja_site: { usuario: 'Verificar loja ou site', resposta: 'Antes de comprar, vamos verificar sinais de segurança.', opcoes: ['Como saber se uma loja é confiável?', 'O preço está muito barato.', 'Querem pagamento por Pix.', 'Recebi um link de compra.', 'Quero escrever minha dúvida.'] },
  dia_a_dia: { usuario: 'Dúvida do dia a dia', resposta: 'Pode me perguntar. Vou tentar explicar de um jeito simples.', opcoes: ['O que é anime?', 'O que é mangá?', 'Como pesquisar no Google?', 'Quero escrever minha dúvida.'] }
};

let pendingSergioAction = null;
let ultimaAcaoFluxo = { chave: '', ts: 0 };
let ultimoEnvioDireto = { pergunta: '', ts: 0 };
const perguntasEmAndamento = new Set();


function mostrar(secaoId) { document.querySelectorAll('main .card[id]').forEach((el) => el.classList.add('hidden')); if (secaoId) document.getElementById(secaoId)?.classList.remove('hidden'); }
function renderFaq(lista, elId = 'faq-lista') {
  const wrap = document.getElementById(elId);
  wrap.innerHTML = lista.map((item, idx) => `<details class="item-faq"><summary id="faq-pergunta-${idx}">${escaparHtml(item.pergunta)}</summary><div class="faq-resposta">${montarResposta(item).html}</div></details>`).join('');
}
function initNavegacao() { document.querySelectorAll('[data-target]').forEach((btn) => btn.addEventListener('click', () => mostrar(btn.dataset.target))); }

function initAcoesHome() {
  document.querySelectorAll('[data-chat-action="open"]').forEach((btn) => btn.addEventListener('click', () => abrirChat()));
  document.querySelectorAll('[data-chat-flow]').forEach((btn) => btn.addEventListener('click', () => iniciarFluxoGuiado(btn.dataset.chatFlow || '')));
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


function adicionarMensagemLocal(role, content, extra = {}) {
  const ultima = historicoSergio[historicoSergio.length - 1];
  if (ultima && ultima.role === role && ultima.content === content) return;
  historicoSergio.push({ role, content, ...extra });
}

function criarRespostaFluxo(resposta, opcoes) {
  return { respostaSimples: resposta, passoAPasso: [], atencao: '', quandoPedirAjuda: '', opcoesFluxo: opcoes };
}

function iniciarFluxoGuiado(tipo) {
  const fluxo = FLUXOS_GUIADOS[tipo];
  if (!fluxo) return;
  const chave = `${tipo}:${fluxo.resposta}`;
  const agora = Date.now();
  if (ultimaAcaoFluxo.chave === chave && (agora - ultimaAcaoFluxo.ts) < 800) return;
  ultimaAcaoFluxo = { chave, ts: agora };
  abrirChat();
  adicionarMensagemLocal('user', fluxo.usuario);
  adicionarMensagemLocal('assistant', fluxo.resposta, { respostaEstruturada: criarRespostaFluxo(fluxo.resposta, fluxo.opcoes), contextoPergunta: fluxo.usuario });
  renderChatSergio();
  salvarHistorico();
}


function setChatAberto(aberto) {
  const widget = document.getElementById('sergio-widget');
  const toggle = document.getElementById('sergio-widget-toggle');
  widget?.classList.toggle('hidden', !aberto);
  toggle?.setAttribute('aria-expanded', aberto ? 'true' : 'false');
}

function abrirChat(pergunta = '') {
  mostrar();
  setChatAberto(true);
  if (!pergunta) return;
  if (window.enviarPerguntaSergioDireta) window.enviarPerguntaSergioDireta(pergunta);
  else pendingSergioAction = { tipo: 'pergunta', valor: pergunta };
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
  const enviarPerguntaDireta = async (perguntaDireta) => {
    const agora = Date.now();
    if (ultimoEnvioDireto.pergunta === perguntaDireta && (agora - ultimoEnvioDireto.ts) < 800) return;
    ultimoEnvioDireto = { pergunta: perguntaDireta, ts: agora };
    campo.value = perguntaDireta;
    await enviarPergunta();
  };
  window.enviarPerguntaSergioDireta = enviarPerguntaDireta;
  const enviarPergunta = async () => {
    const pergunta = campo.value.trim(); if (!pergunta) return;
    const requestId = ++sergioRequestId; historicoSergio.push({ role: 'user', content: pergunta }); campo.value = ''; historicoSergio.push({ role: 'assistant', content: 'Sérgio está pensando...' }); renderChatSergio(); salvarHistorico();
    botao.disabled = true; botao.textContent = 'Sérgio está pensando...';
    try {
      if (perguntasEmAndamento.has(pergunta)) throw new Error('duplicada_em_andamento');
      perguntasEmAndamento.add(pergunta);
      const contexto = historicoSergio.filter((m) => m.role !== 'assistant' || m.content !== 'Sérgio está pensando...').slice(-6).map((m) => ({ role: m.role, content: m.content }));
      let respostaIA;
      try {
        respostaIA = await perguntarIA(pergunta, contexto);
      } catch (_) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        respostaIA = await perguntarIA(pergunta, contexto);
      }
      if (requestId !== sergioRequestId) return;
      historicoSergio.pop(); historicoSergio.push({ role: 'assistant', content: respostaIA.respostaSimples, respostaEstruturada: respostaIA, contextoPergunta: pergunta });
    } catch (_) {
      if (requestId !== sergioRequestId) return; historicoSergio.pop();
      const melhor = encontrarMelhorResposta(FAQ, pergunta);
      historicoSergio.push(melhor ? { role: 'assistant', content: melhor.respostaSimples, respostaEstruturada: melhor, contextoPergunta: pergunta } : { role: 'assistant', content: 'Modo local: na versão Vercel eu também uso IA. Tente explicar com mais detalhes.' });
    } finally {
      perguntasEmAndamento.delete(pergunta);
      if (requestId === sergioRequestId) { botao.disabled = false; botao.textContent = 'Enviar'; renderChatSergio(); salvarHistorico(); }
    }
  };
  botao.addEventListener('click', enviarPergunta);
  campo.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); enviarPergunta(); } });
  document.getElementById('sergio-widget').addEventListener('click', (event) => { const target = event.target.closest('[data-question]'); if (!target) return; fecharPaineisOpcoes(); const perguntaChip = target.dataset.question || ''; if (normalizarTexto(perguntaChip).includes('quero escrever')) { campo.focus(); return; } enviarPerguntaDireta(perguntaChip); });
  botaoLimpar.addEventListener('click', () => { historicoSergio.splice(0, historicoSergio.length); localStorage.removeItem(STORAGE_SERGIO); renderChatSergio(); });
  if (pendingSergioAction?.tipo === 'pergunta') { enviarPerguntaDireta(pendingSergioAction.valor || ''); pendingSergioAction = null; }
}


async function configurarAvatarSergio() { try { const caminhoAvatar = 'assets/sergio-avatar.png'; const resp = await fetch(caminhoAvatar, { method: 'HEAD' }); if (!resp.ok) throw new Error(); avatarSergio = caminhoAvatar; document.querySelectorAll('.sergio-avatar').forEach((img) => { img.src = caminhoAvatar; img.classList.remove('hidden'); }); document.querySelectorAll('.avatar-fallback').forEach((el) => el.classList.add('hidden')); } catch (_) {} }
async function carregarDados() { FAQ = await fetch('data/faq.json').then((r) => r.json()); CATEGORIAS = await fetch('data/categorias.json').then((r) => r.json()); }
async function init() { await carregarDados(); await configurarAvatarSergio(); initNavegacao(); initWidgetSergio(); initFaq(); initAvaliacao(); initOpcoesRapidas(); initSergio(); initAcoesHome(); }

if ('serviceWorker' in navigator) window.addEventListener('load', async () => { const reg = await navigator.serviceWorker.register('service-worker.js'); reg.addEventListener('updatefound', () => document.getElementById('sw-update-msg')?.classList.remove('hidden')); });
init();
