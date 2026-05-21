function limparTexto(valor = '') {
  return String(valor || '').replace(/```json/gi, '').replace(/```/g, '').replace(/[\[\]{}"]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizarRespostaIA(payload = {}) {
  const r = payload?.resposta || payload || {};
  const passos = Array.isArray(r.passoAPasso) ? r.passoAPasso.map((p) => limparTexto(p)).filter(Boolean) : [];
  return {
    tipo: payload?.tipo || 'fallback',
    origem: payload?.origem || 'local',
    respostaSimples: limparTexto(r.respostaSimples || 'Vamos resolver isso com calma.'),
    passoAPasso: passos.length ? passos : ['Siga com calma e peça ajuda se precisar.'],
    atencao: limparTexto(r.atencao || 'Não compartilhe dados pessoais.'),
    quandoPedirAjuda: limparTexto(r.quandoPedirAjuda || 'Peça ajuda se houver risco ou dúvida.')
  };
}

async function perguntarIA(pergunta, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resposta = await fetch('/api/sergio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pergunta }),
      signal: controller.signal
    });
    if (!resposta.ok) throw new Error('api_error');
    const dados = await resposta.json().catch(() => ({}));
    return normalizarRespostaIA(dados);
  } finally {
    clearTimeout(timer);
  }
}
