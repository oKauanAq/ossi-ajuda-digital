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
  const apoio = detectarApoioVisual(item.respostaSimples, pergunta, item.categoria || '');
  const passosHtml = item.passoAPasso.map((p, i) => `<li><span class="passo-numero">${i + 1}</span><span>${p}</span></li>`).join('');
  const texto = `Resposta simples: ${item.respostaSimples}\nPasso a passo: ${item.passoAPasso.join(' ')}\nAtenção: ${item.atencao}\nQuando pedir ajuda: ${item.quandoPedirAjuda}`;
  return {
    html: `<div class="bloco-sergio">
      ${apoio ? `<div class="apoio-visual" data-asset-path="assets/guias/"><strong>${apoio.emoji}</strong><span>${apoio.titulo}</span></div>` : ''}
      <p class="resposta-destaque">${item.respostaSimples}</p>
      <ol class="passos-sergio">${passosHtml}</ol>
      <p class="caixa-atencao"><strong>Atenção:</strong> ${item.atencao}</p>
      <p class="caixa-ajuda"><strong>Quando pedir ajuda:</strong> ${item.quandoPedirAjuda}</p>
      <button class="small-btn btn-ouvir" onclick='ouvirTexto(${JSON.stringify(texto)})'>🔊 Ouvir resposta</button>
    </div>`,
    texto
  };
}

function pontuacaoFaq(item, texto) {
  const t = normalizarTexto(texto);
  const tokens = t.split(/\s+/).map((termo) => termo.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  const relevantes = tokens.filter((termo) => termo.length > 2 && !termosGenericos.has(termo));
  if (relevantes.length === 0) return -10;
  let pontos = 0;
  const perguntaFaq = normalizarTexto(item.pergunta || '');
  const categoriaFaq = normalizarTexto(item.categoria || '');
  const palavrasFaq = (item.palavrasChave || []).map((k) => normalizarTexto(k));
  for (const termo of relevantes) {
    if (perguntaFaq.includes(termo)) pontos += 3;
    if (categoriaFaq.includes(termo)) pontos += 2;
    if (palavrasFaq.some((k) => k.includes(termo) || termo.includes(k))) pontos += 4;
  }
  if (perguntaFaq.includes(t) || t.includes(perguntaFaq)) pontos += 4;
  return pontos;
}

function encontrarMelhorResposta(faq, pergunta) {
  let melhor = null;
  let max = -999;
  for (const item of faq) {
    const pontos = pontuacaoFaq(item, pergunta);
    if (pontos > max) {
      max = pontos;
      melhor = item;
    }
  }
  return max >= 8 ? melhor : null;
}

function initMicrofone(inputEl) {
  const btnMic = document.getElementById('btn-sergio-mic');
  const status = document.getElementById('status-microfone');
  const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!Reconhecimento) {
    btnMic.classList.add('hidden');
    status.classList.remove('hidden');
    status.textContent = 'Microfone não disponível neste navegador.';
    return;
  }

  const reconhecimento = new Reconhecimento();
  reconhecimento.lang = 'pt-BR';
  reconhecimento.interimResults = false;

  reconhecimento.onstart = () => {
    status.classList.remove('hidden');
    status.textContent = 'Estou ouvindo...';
  };

  btnMic.addEventListener('click', () => {
    status.classList.remove('hidden');
    status.textContent = 'Pode falar agora.';
    try {
      reconhecimento.start();
    } catch (_) {}
  });

  reconhecimento.onresult = (event) => {
    const texto = event.results?.[0]?.[0]?.transcript?.trim();
    if (texto) {
      inputEl.value = texto;
      inputEl.focus();
    }
  };

  reconhecimento.onend = () => {
    setTimeout(() => status.classList.add('hidden'), 1400);
  };

  reconhecimento.onerror = (event) => {
    status.classList.remove('hidden');
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      status.textContent = 'Permissão de microfone negada. Libere o acesso no navegador.';
      return;
    }
    status.textContent = 'Não entendi. Tente de novo ou digite.';
  };
}
