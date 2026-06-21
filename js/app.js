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
  senha_conta: { usuario: 'Senha ou conta', resposta: 'Posso ajudar com senha ou conta. Primeiro escolha onde está o problema.', opcoes: ['Facebook', 'Instagram', 'Gov.br', 'Banco', 'E-mail', 'Outro aplicativo'] },
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



function mapearOpcaoFluxoParaPergunta(opcao = '') {
  const mapa = {
    'facebook': 'Esqueci a senha do Facebook',
    'instagram': 'Esqueci a senha do Instagram',
    'gov.br': 'Esqueci a senha do Gov.br',
    'banco': 'Esqueci a senha do aplicativo do banco',
    'e-mail': 'Esqueci a senha do e-mail',
    'email': 'Esqueci a senha do e-mail',
    'whatsapp': 'Estou com dúvida no WhatsApp',
    'entrar no app': 'Não consigo entrar no app do banco',
    'fazer pix': 'Como fazer Pix?',
    'ver saldo': 'Como ver saldo no aplicativo do banco?',
    'mandar mensagem': 'Como mandar mensagem no WhatsApp?',
    'colocar foto': 'Como colocar foto no WhatsApp?',
    'recuperar conta': 'Esqueci minha senha',
    'verificar golpe': 'Acho que estou passando por um golpe. O que devo fazer?',
    'volume': 'Como aumentar o volume?',
    'wi‑fi': 'Como conectar no Wi-Fi?',
    'wi-fi': 'Como conectar no Wi-Fi?',
    'print': 'Como tirar print?',
    'celular sem som': 'Meu celular está sem som.'
  };
  return mapa[normalizarTexto(opcao)] || '';
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
  const elAssuntos = document.getElementById('chips-assuntos');
  const elDuvidas = document.getElementById('chips-duvidas');
  if (elAssuntos) elAssuntos.innerHTML = renderChips(OPCOES_RAPIDAS);
  if (elDuvidas) elDuvidas.innerHTML = renderChips(DUVIDAS_COMUNS, 'secundario');
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


const VOZ_DURACAO_MAX_MS = 7000;
const VOZ_SAMPLE_RATE = 16000;
const VOZ_ENDPOINT = '/api/voz/transcrever';
let estadoVozSergio = { stream: null, audioContext: null, processor: null, source: null, buffers: [], sampleRate: 0, timer: null, gravando: false, transcricao: '' };

function concatenarBuffersAudio(buffers) {
  const total = buffers.reduce((soma, buffer) => soma + buffer.length, 0);
  const resultado = new Float32Array(total);
  let offset = 0;
  buffers.forEach((buffer) => { resultado.set(buffer, offset); offset += buffer.length; });
  return resultado;
}

function reamostrarAudio(input, inputRate, outputRate) {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const novoTamanho = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(novoTamanho);
  for (let i = 0; i < novoTamanho; i += 1) {
    const pos = i * ratio;
    const antes = Math.floor(pos);
    const depois = Math.min(antes + 1, input.length - 1);
    const peso = pos - antes;
    output[i] = (input[antes] * (1 - peso)) + (input[depois] * peso);
  }
  return output;
}

function codificarWavMono16(samples, sampleRate) {
  const bytesPorSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPorSample);
  const view = new DataView(buffer);
  const escrever = (offset, texto) => { for (let i = 0; i < texto.length; i += 1) view.setUint8(offset + i, texto.charCodeAt(i)); };
  escrever(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPorSample, true);
  escrever(8, 'WAVE');
  escrever(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPorSample, true);
  view.setUint16(32, bytesPorSample, true);
  view.setUint16(34, 16, true);
  escrever(36, 'data');
  view.setUint32(40, samples.length * bytesPorSample, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1, offset += 2) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(new Error('falha_leitura_audio'));
    reader.readAsDataURL(blob);
  });
}

function limparCapturaVoz() {
  if (estadoVozSergio.timer) clearTimeout(estadoVozSergio.timer);
  estadoVozSergio.timer = null;
  if (estadoVozSergio.processor) estadoVozSergio.processor.disconnect();
  if (estadoVozSergio.source) estadoVozSergio.source.disconnect();
  if (estadoVozSergio.audioContext) estadoVozSergio.audioContext.close().catch(() => {});
  if (estadoVozSergio.stream) estadoVozSergio.stream.getTracks().forEach((track) => track.stop());
  estadoVozSergio.processor = null;
  estadoVozSergio.source = null;
  estadoVozSergio.audioContext = null;
  estadoVozSergio.stream = null;
  estadoVozSergio.gravando = false;
}

function initModoVozSergio(campo, enviarPerguntaDireta) {
  const btnGravar = document.getElementById('btn-voz-sergio');
  const btnParar = document.getElementById('btn-parar-voz-sergio');
  const status = document.getElementById('status-voz-sergio');
  const confirmacao = document.getElementById('confirmacao-voz-sergio');
  const textoVoz = document.getElementById('texto-voz-sergio');
  const btnEnviar = document.getElementById('btn-enviar-voz-sergio');
  const btnRegravar = document.getElementById('btn-regravar-voz-sergio');
  const btnEditar = document.getElementById('btn-editar-voz-sergio');
  if (!btnGravar || !btnParar || !status || !confirmacao || !textoVoz) return;

  const mostrarStatus = (texto) => { status.textContent = texto; };
  const setGravando = (gravando) => {
    btnGravar.classList.toggle('hidden', gravando);
    btnParar.classList.toggle('hidden', !gravando);
  };
  const esconderConfirmacao = () => {
    estadoVozSergio.transcricao = '';
    textoVoz.textContent = '';
    confirmacao.classList.add('hidden');
  };

  async function enviarAudioParaTranscricao(blob) {
    mostrarStatus('Estou entendendo sua fala...');
    const audioBase64 = await blobParaBase64(blob);
    const resposta = await fetch(VOZ_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ audioBase64, mimeType: 'audio/wav' })
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok || !dados.ok || !dados.transcricao) {
      if (dados.codigo) console.warn('Erro de transcrição:', dados.codigo);
      throw new Error(dados.erro || 'voz_indisponivel');
    }
    estadoVozSergio.transcricao = String(dados.transcricao).trim();
    textoVoz.textContent = estadoVozSergio.transcricao;
    confirmacao.classList.remove('hidden');
    mostrarStatus('Entendi isso. Confira antes de enviar.');
  }

  async function pararGravacao() {
    if (!estadoVozSergio.gravando) return;
    const buffers = estadoVozSergio.buffers.slice();
    const sampleRate = estadoVozSergio.sampleRate;
    limparCapturaVoz();
    setGravando(false);
    if (!buffers.length) {
      mostrarStatus('Não consegui entender o áudio. Tente gravar novamente ou escreva sua dúvida.');
      return;
    }
    try {
      const mono = concatenarBuffersAudio(buffers);
      const audio16k = reamostrarAudio(mono, sampleRate, VOZ_SAMPLE_RATE);
      const wav = codificarWavMono16(audio16k, VOZ_SAMPLE_RATE);
      await enviarAudioParaTranscricao(wav);
    } catch (_) {
      mostrarStatus('Não consegui entender o áudio. Tente gravar novamente ou escreva sua dúvida.');
    }
  }

  async function iniciarGravacao() {
    esconderConfirmacao();
    if (!navigator.mediaDevices?.getUserMedia || (!window.AudioContext && !window.webkitAudioContext)) {
      mostrarStatus('Este aparelho não permite gravar áudio aqui. Escreva sua dúvida para o Sérgio.');
      return;
    }
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      mostrarStatus('Este aparelho não permite gravar áudio aqui. Escreva sua dúvida para o Sérgio.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, noiseSuppression: true, echoCancellation: true } });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioCtx();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      estadoVozSergio = { stream, audioContext, processor, source, buffers: [], sampleRate: audioContext.sampleRate, timer: null, gravando: true, transcricao: '' };
      processor.onaudioprocess = (event) => {
        if (!estadoVozSergio.gravando) return;
        estadoVozSergio.buffers.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(audioContext.destination);
      setGravando(true);
      mostrarStatus('Estou ouvindo... fale com calma.');
      estadoVozSergio.timer = setTimeout(() => pararGravacao(), VOZ_DURACAO_MAX_MS);
    } catch (error) {
      limparCapturaVoz();
      setGravando(false);
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        mostrarStatus('Não consegui acessar o microfone. Você pode escrever sua dúvida no campo abaixo.');
        return;
      }
      mostrarStatus('Este aparelho não permite gravar áudio aqui. Escreva sua dúvida para o Sérgio.');
    }
  }

  btnGravar.addEventListener('click', iniciarGravacao);
  btnParar.addEventListener('click', pararGravacao);
  btnRegravar?.addEventListener('click', iniciarGravacao);
  btnEditar?.addEventListener('click', () => {
    if (!estadoVozSergio.transcricao) return;
    campo.value = estadoVozSergio.transcricao;
    campo.focus();
    mostrarStatus('Você pode editar o texto antes de enviar.');
  });
  btnEnviar?.addEventListener('click', () => {
    if (!estadoVozSergio.transcricao) return;
    const transcricao = estadoVozSergio.transcricao;
    esconderConfirmacao();
    mostrarStatus('Pergunta enviada ao Sérgio.');
    enviarPerguntaDireta(transcricao);
  });
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
  initModoVozSergio(campo, enviarPerguntaDireta);
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
       'Não consegui responder agora. Tente explicar sua dúvida com outras palavras.'    } finally {
      perguntasEmAndamento.delete(pergunta);
      if (requestId === sergioRequestId) { botao.disabled = false; botao.textContent = 'Enviar'; renderChatSergio(); salvarHistorico(); }
    }
  };
  botao.addEventListener('click', enviarPergunta);
  campo.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); enviarPergunta(); } });
  document.getElementById('sergio-widget').addEventListener('click', (event) => { const targetPergunta = event.target.closest('[data-question]'); const targetFluxo = event.target.closest('[data-flow-option]'); if (!targetPergunta && !targetFluxo) return; fecharPaineisOpcoes(); const opcaoFluxo = targetFluxo?.dataset.flowOption || ''; if (opcaoFluxo) { if (normalizarTexto(opcaoFluxo).includes('outro aplicativo') || normalizarTexto(opcaoFluxo).includes('outro problema') || normalizarTexto(opcaoFluxo).includes('outro assunto')) { campo.focus(); return; } const perguntaMapeada = mapearOpcaoFluxoParaPergunta(opcaoFluxo); if (perguntaMapeada) { enviarPerguntaDireta(perguntaMapeada); return; } enviarPerguntaDireta(opcaoFluxo); return; } const perguntaChip = targetPergunta.dataset.question || ''; if (normalizarTexto(perguntaChip).includes('quero escrever')) { campo.focus(); return; } enviarPerguntaDireta(perguntaChip); });
  botaoLimpar.addEventListener('click', () => { historicoSergio.splice(0, historicoSergio.length); localStorage.removeItem(STORAGE_SERGIO); renderChatSergio(); });
  if (pendingSergioAction?.tipo === 'pergunta') { enviarPerguntaDireta(pendingSergioAction.valor || ''); pendingSergioAction = null; }
}


async function configurarAvatarSergio() { try { const caminhoAvatar = 'assets/sergio-avatar.png'; const resp = await fetch(caminhoAvatar, { method: 'HEAD' }); if (!resp.ok) throw new Error(); avatarSergio = caminhoAvatar; document.querySelectorAll('.sergio-avatar').forEach((img) => { img.src = caminhoAvatar; img.classList.remove('hidden'); }); document.querySelectorAll('.avatar-fallback').forEach((el) => el.classList.add('hidden')); } catch (_) {} }
async function carregarDados() { FAQ = await fetch('data/faq.json').then((r) => r.json()); CATEGORIAS = await fetch('data/categorias.json').then((r) => r.json()); }
async function init() { await carregarDados(); await configurarAvatarSergio(); initNavegacao(); initWidgetSergio(); initFaq(); initAvaliacao(); initOpcoesRapidas(); initSergio(); initAcoesHome(); }

if ('serviceWorker' in navigator) window.addEventListener('load', async () => { const reg = await navigator.serviceWorker.register('service-worker.js'); reg.addEventListener('updatefound', () => document.getElementById('sw-update-msg')?.classList.remove('hidden')); });
init();
