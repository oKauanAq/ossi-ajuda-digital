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
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function ehSensivel(texto = '') {
  const t = normalizarTexto(texto);
  return termosSensiveis.some((k) => t.includes(normalizarTexto(k)));
}

function ehPerguntaVaga(texto = '') {
  const t = normalizarTexto(texto);
  if (!t || t.length < 6) return true;

  if (frasesVagas.some((item) => t === normalizarTexto(item))) return true;

  const semFrasesGenericas = t
    .replace(/\b(me ajuda|tenho uma duvida|tenho duvida|duvida|nao sei mexer|queria perguntar uma coisa|gostaria de tirar uma duvida)\b/g, ' ')
    .trim();

  const tokens = semFrasesGenericas
    .split(/\s+/)
    .map((tok) => tok.replace(/[^\p{L}\p{N}-]/gu, ''))
    .filter(Boolean);

  const especificos = tokens.filter((tok) => tok.length > 2 && !termosGenericos.has(tok));
  if (especificos.some((tok) => termosIntencaoDigital.has(tok))) return false;

  return especificos.length === 0;
}

function respostaEsclarecimento() {
  return montarResposta({
    respostaSimples: 'Boa! Eu sou o Sérgio. Me diga no que você precisa de ajuda.',
    passoAPasso: [
      'Escreva sua dúvida em uma frase simples.',
      'Se for sobre celular, aplicativo, mensagem, golpe ou internet, explique o que apareceu na tela.',
      'Se for uma dúvida do dia a dia, diga o que você quer fazer ou entender.'
    ],
    atencao: 'Não envie senha, código, CPF, cartão, documento ou dados bancários.',
    quandoPedirAjuda: 'Se envolver dinheiro, link estranho, conta bloqueada, saúde ou medo de golpe, peça ajuda a alguém de confiança ou à equipe da OSSI.'
  });
}

function montarResposta(item) {
  const passosHtml = item.passoAPasso.map((p) => `<li>${p}</li>`).join('');
  const texto = `Resposta simples: ${item.respostaSimples}\nPasso a passo: ${item.passoAPasso.join(' ')}\nAtenção: ${item.atencao}\nQuando pedir ajuda: ${item.quandoPedirAjuda}`;
  return {
    html: `<div class="bloco-sergio">
      <p><strong>Resposta simples:</strong> ${item.respostaSimples}</p>
      <p><strong>Passo a passo:</strong></p>
      <ol>${passosHtml}</ol>
      <p><strong>Atenção:</strong> ${item.atencao}</p>
      <p><strong>Quando pedir ajuda:</strong> ${item.quandoPedirAjuda}</p>
      <button class="small-btn" onclick='ouvirTexto(${JSON.stringify(texto)})'>Ouvir resposta</button>
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
