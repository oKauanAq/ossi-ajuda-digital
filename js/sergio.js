const termosSensiveis = ['pix','banco','senha','cpf','cartão','codigo','código','documento','saúde','golpe','link','desconhecido','compra','dinheiro'];

function ehSensivel(texto='') {
  const t = texto.toLowerCase();
  return termosSensiveis.some(k => t.includes(k));
}

function montarResposta(item) {
  const texto = `Resposta simples: ${item.respostaSimples}\n\nPasso a passo: ${item.passoAPasso.join(' ')}\n\nAtenção: ${item.atencao}\n\nQuando pedir ajuda: ${item.quandoPedirAjuda}`;
  return { html: `
    <div class="bloco-sergio">
      <p><strong>Resposta simples:</strong> ${item.respostaSimples}</p>
      <p><strong>Passo a passo:</strong> ${item.passoAPasso.join(' ')}</p>
      <p><strong>Atenção:</strong> ${item.atencao}</p>
      <p><strong>Quando pedir ajuda:</strong> ${item.quandoPedirAjuda}</p>
      <button class="small-btn" onclick='ouvirTexto(${JSON.stringify(texto)})'>Ouvir resposta</button>
    </div>`,
    texto
  };
}

function respostaPadraoSegura() {
  const item = {
    respostaSimples: 'Vamos com calma. Não faça nenhuma ação agora.',
    passoAPasso: ['Não clique em links.', 'Não envie dados pessoais.', 'Não faça Pix nem pagamentos.', 'Peça ajuda de alguém de confiança.'],
    atencao: 'Este sistema não acessa banco, gov.br ou compras.',
    quandoPedirAjuda: 'Se houver dinheiro, senha, CPF, código, documento ou medo de golpe.'
  };
  return montarResposta(item);
}
