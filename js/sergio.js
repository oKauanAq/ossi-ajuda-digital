const termosSensiveis = [
  'pix', 'banco', 'senha', 'cpf', 'cartão', 'cartao', 'codigo', 'código', 'documento',
  'saúde', 'saude', 'golpe', 'link', 'desconhecido', 'compra', 'dinheiro', 'cartao'
];

const termosVagos = [
  'oi', 'olá', 'ola', 'tenho uma dúvida', 'tenho uma duvida', 'me ajuda', 'ajuda',
  'não sei mexer', 'nao sei mexer', 'queria perguntar uma coisa', 'dúvida', 'duvida'
];

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
  if (termosVagos.some((item) => t === normalizarTexto(item) || t.includes(normalizarTexto(item)))) return true;
  const tokens = t.split(/\s+/).filter(Boolean);
  const especificos = tokens.filter((tok) => tok.length > 2 && !termosGenericos.has(tok));
  return especificos.length === 0;
}

function respostaEsclarecimento() {
  return montarResposta({
    respostaSimples: 'Claro. Me diga qual é a sua dúvida sobre celular, WhatsApp, internet, compras, banco, golpes ou aplicativos.',
    passoAPasso: [
      'Escreva em uma frase o que aconteceu.',
      'Diga qual aplicativo ou função você estava usando.',
      'Se apareceu aviso, copie o texto do aviso.'
    ],
    atencao: 'Não compartilhe senha, código, CPF ou dados do cartão.',
    quandoPedirAjuda: 'Se houver pedido de dinheiro, link suspeito ou medo de golpe.'
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

function respostaPadraoSegura() {
  return montarResposta({
    respostaSimples: 'Vamos com calma. Não faça nenhuma ação agora.',
    passoAPasso: ['Não clique em links.', 'Não envie dados pessoais.', 'Não faça Pix nem pagamentos.', 'Peça ajuda de alguém de confiança.'],
    atencao: 'Este sistema não acessa banco, gov.br ou compras.',
    quandoPedirAjuda: 'Se houver dinheiro, senha, CPF, código, documento ou medo de golpe.'
  });
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
