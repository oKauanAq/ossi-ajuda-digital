const termosSensiveis = ['pix','banco','senha','cpf','cartão','codigo','código','documento','saúde','golpe','link','desconhecido','compra','dinheiro'];

function ehSensivel(texto='') {
  const t = texto.toLowerCase();
  return termosSensiveis.some(k => t.includes(k));
}

function montarResposta(item) {
  const passosHtml = item.passoAPasso.map((p, i) => `<li>${i + 1}. ${p}</li>`).join('');
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
  const t = texto.toLowerCase();
  let pontos = 0;
  if (item.categoria.toLowerCase().includes(t) || t.includes(item.categoria.toLowerCase())) pontos += 4;
  if (item.pergunta.toLowerCase().includes(t) || t.includes(item.pergunta.toLowerCase())) pontos += 5;
  for (const k of (item.palavrasChave || [])) {
    if (t.includes(k.toLowerCase())) pontos += 3;
  }
  for (const termo of t.split(/\s+/)) {
    if (termo.length > 2 && item.pergunta.toLowerCase().includes(termo)) pontos += 1;
  }
  return pontos;
}

function encontrarMelhorResposta(faq, pergunta) {
  let melhor = null;
  let max = 0;
  for (const item of faq) {
    const pontos = pontuacaoFaq(item, pergunta);
    if (pontos > max) {
      max = pontos;
      melhor = item;
    }
  }
  return max > 0 ? melhor : null;
}
