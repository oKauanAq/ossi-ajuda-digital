const termosBloqueadosIA = [
  'senha', 'cpf', 'cartão', 'cartao', 'código', 'codigo', 'documento',
  'pix', 'banco', 'dinheiro', 'saúde', 'saude', 'link', 'golpe'
];

function deveBloquearIA(pergunta = '') {
  const texto = pergunta.toLowerCase();
  return termosBloqueadosIA.some((termo) => texto.includes(termo));
}

async function perguntarIA(pergunta, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resposta = await fetch('/api/sergio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pergunta }),
      signal: controller.signal
    });

    if (!resposta.ok) {
      throw new Error('IA indisponível');
    }

    const dados = await resposta.json();
    if (!dados?.resposta) {
      throw new Error('Resposta inválida da IA');
    }

    return dados.resposta;
  } finally {
    clearTimeout(timer);
  }
}
