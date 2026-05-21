const termosSensiveis = [];

const frasesVagas = [
  'boa', 'bom dia', 'boa tarde', 'boa noite',
  'oi', 'olá', 'ola', 'tenho uma dúvida', 'tenho uma duvida', 'me ajuda', 'ajuda',
  'não sei mexer', 'nao sei mexer', 'queria perguntar uma coisa', 'dúvida', 'duvida',
  'ola gostaria de tirar uma duvida'
];

const termosIntencaoDigital = new Set([
  'facebook', 'instagram', 'messenger', 'conversar', 'amiga', 'amigo', 'mensagem',
  'foto', 'perfil', 'abrir', 'apagar', 'enviar', 'receber', 'camera', 'câmera',
  'volume', 'print', 'wifi', 'wi-fi', 'email', 'e-mail', 'aplicativo', 'app',
  'celular', 'whatsapp', 'ligacao', 'ligação'
]);

const termosGenericos = new Set([
  'duvida', 'dúvida', 'ajuda', 'celular', 'aplicativo', 'app', 'whatsapp', 'internet',
  'coisa', 'mexer', 'ola', 'olá', 'oi', 'tenho', 'queria', 'perguntar', 'sobre'
]);

function normalizarTexto(texto = '') {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function escaparHtml(texto = '') {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function limparCampoRender(texto = '') {
  return String(texto)
    .replace(/```json|```/gi, ' ')
    .replace(/[{}\[\]"]/g, ' ')
    .replace(/\\[nrt]/g, ' ')
    .replace(/\\/g, ' ')
    .replace(/\b(resposta\s*simples|respostasimples|passo\s*a\s*passo|passoapasso|atencao|aten[cç][aã]o|quando\s*pedir\s*ajuda|quandopedirajuda)\s*[:=-]?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizarResposta(item = {}) {
  const passos = Array.isArray(item.passoAPasso) ? item.passoAPasso : String(item.passoAPasso || '').split(/\n|\s*\d+[).:-]\s*/);
  return {
    respostaSimples: limparCampoRender(item.respostaSimples),
    passoAPasso: passos.map((p) => limparCampoRender(p)).filter(Boolean).slice(0, 6),
    atencao: limparCampoRender(item.atencao),
    quandoPedirAjuda: limparCampoRender(item.quandoPedirAjuda)
  };
}

function detectarApoioVisual(resposta = '', pergunta = '', tipo = '') {
  const base = normalizarTexto(`${resposta} ${pergunta} ${tipo}`);
  const regras = [
    { termos: ['volume', 'som', 'audio'], emoji: '📱🔊', titulo: 'Botões de volume' },
    { termos: ['whatsapp'], emoji: '🟢', titulo: 'WhatsApp' },
    { termos: ['facebook', 'messenger', 'mensagem'], emoji: '💬', titulo: 'Mensagens' },
    { termos: ['golpe', 'link', 'suspeito', 'urgente'], emoji: '🛡️', titulo: 'Cuidado com golpe' },
    { termos: ['pix', 'banco', 'dinheiro'], emoji: '💳', titulo: 'Atenção com dinheiro' },
    { termos: ['senha', 'conta', 'codigo'], emoji: '🔐', titulo: 'Segurança da conta' },
    { termos: ['loja', 'site', 'compra'], emoji: '🛒', titulo: 'Verifique antes de comprar' },
    { termos: ['receita', 'dia a dia', 'cozinha'], emoji: '📝', titulo: 'Dica do dia a dia' }
  ];
  return regras.find((regra) => regra.termos.some((termo) => base.includes(termo))) || null;
}

function montarResposta(item, pergunta = '') {
  const limpo = sanitizarResposta(item);
  const apoio = detectarApoioVisual(limpo.respostaSimples, pergunta, item.categoria || '');
  const passosHtml = limpo.passoAPasso.length ? limpo.passoAPasso.map((p, i) => `<li><span class="passo-numero">${i + 1}</span><span>${escaparHtml(p)}</span></li>`).join('') : '';
  const texto = `Resposta simples: ${limpo.respostaSimples}\n${limpo.passoAPasso.length ? `Passo a passo: ${limpo.passoAPasso.join(' ')}\n` : ''}${limpo.atencao ? `Atenção: ${limpo.atencao}\n` : ''}${limpo.quandoPedirAjuda ? `Quando pedir ajuda: ${limpo.quandoPedirAjuda}` : ''}`.trim();
  return {
    html: `<div class="bloco-sergio">
      ${apoio ? `<div class="apoio-visual" data-asset-path="assets/guias/"><strong>${apoio.emoji}</strong><span>${escaparHtml(apoio.titulo)}</span></div>` : ''}
      <p class="resposta-destaque">${escaparHtml(limpo.respostaSimples)}</p>
      ${passosHtml ? `<ol class="passos-sergio">${passosHtml}</ol>` : ""}
      ${limpo.atencao ? `<p class="caixa-atencao"><strong>Atenção:</strong> ${escaparHtml(limpo.atencao)}</p>` : ""}
      ${limpo.quandoPedirAjuda ? `<p class="caixa-ajuda"><strong>Quando pedir ajuda:</strong> ${escaparHtml(limpo.quandoPedirAjuda)}</p>` : ""}
    </div>`,
    texto
  };
}

function initMicrofone(inputEl) {
  const btnMic = document.getElementById('btn-sergio-mic');
  const status = document.getElementById('status-microfone');
  const btnTesteMic = document.getElementById('btn-sergio-mic-test');
  const autoEnviar = document.getElementById('sergio-auto-enviar');
  const btnEnviar = document.getElementById('btn-sergio');
  const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;
  const temMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const ambienteSeguro = window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname);

  
  btnTesteMic?.addEventListener('click', async () => {
    status.classList.remove('hidden');
    status.textContent = `Diagnóstico: navegador ${Reconhecimento ? 'compatível' : 'incompatível'}, contexto ${ambienteSeguro ? 'seguro' : 'não seguro'}.`;
    if (!Reconhecimento || !temMedia || !ambienteSeguro) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      status.textContent = 'Diagnóstico: microfone disponível e permissão concedida. Clique em “🎙️ Falar”.';
    } catch (error) {
      status.textContent = error?.name === 'NotAllowedError'
        ? 'Permissão negada. Clique no cadeado do site para permitir o microfone.'
        : 'Não consegui validar o microfone. Tente Google Chrome/Edge ou digite sua pergunta.';
    }
  });
if (!Reconhecimento || !temMedia || !ambienteSeguro) {
    status.classList.remove('hidden');
    status.textContent = 'Neste navegador, falar pelo microfone pode não funcionar. Use Google Chrome ou digite.';
    return;
  }

  const reconhecimento = new Reconhecimento();
  reconhecimento.lang = 'pt-BR';
  reconhecimento.interimResults = false;

  const resetBotao = () => { btnMic.textContent = '🎙️ Falar'; };

  reconhecimento.onstart = () => {
    btnMic.textContent = '🎙️ Ouvindo...';
    status.classList.remove('hidden');
    status.textContent = 'Reconhecimento iniciado. Estou ouvindo, pode falar agora.';
  };

  btnMic.addEventListener('click', async () => {
    status.classList.remove('hidden');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      reconhecimento.start();
    } catch (error) {
      resetBotao();
      if (error?.name === 'NotAllowedError') {
        status.textContent = 'Permissão negada. Clique no cadeado do site e permita o microfone.';
      } else if (error?.name === 'NotFoundError') {
        status.textContent = 'Nenhum microfone foi encontrado.';
      } else {
        status.textContent = 'Não consegui acessar o microfone. Tente usar Google Chrome ou Edge. Você também pode digitar sua pergunta.';
      }
    }
  });

  reconhecimento.onresult = (event) => {
    const texto = event.results?.[0]?.[0]?.transcript?.trim();
    if (!texto) { status.textContent = 'Não reconheci sua fala. Tente novamente ou digite sua pergunta.'; return; }
    inputEl.value = texto;
    inputEl.focus();
    if (autoEnviar?.checked) {
      btnEnviar.click();
      status.textContent = 'Texto reconhecido e enviado automaticamente.';
    } else {
      status.textContent = 'Confira o texto e clique em Enviar.';
    }
  };

  reconhecimento.onend = () => {
    resetBotao();
    if (!status.textContent.includes('reconhecido')) status.textContent = 'Reconhecimento finalizado.';
  };

  reconhecimento.onerror = (event) => {
    resetBotao();
    status.classList.remove('hidden');
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      status.textContent = 'Permissão negada. Clique no cadeado do site e permita o microfone.';
      return;
    }
    status.textContent = 'Não consegui acessar o microfone. Tente usar Google Chrome ou Edge. Você também pode digitar sua pergunta.';
  };
}
