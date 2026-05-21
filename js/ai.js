function limparTextoExibicao(valor = '') {
  let texto = String(valor || '').trim();
  if (!texto) return '';

  texto = texto.replace(/```json/gi, '').replace(/```/g, '').trim();
  const inicio = texto.indexOf('{');
  const fim = texto.lastIndexOf('}');

  if (inicio >= 0 && fim > inicio) {
    const jsonCandidato = texto.slice(inicio, fim + 1);
    try {
      const parsed = JSON.parse(jsonCandidato);
      if (parsed?.respostaSimples || parsed?.passoAPasso) {
        texto = [parsed.respostaSimples, ...(parsed.passoAPasso || []), parsed.atencao, parsed.quandoPedirAjuda]
          .filter(Boolean)
          .join(' ');
      }
    } catch {
      texto = texto.replace(/\{[\s\S]*\}/g, ' ');
    }
  }

  return texto
    .replace(/"respostaSimples"\s*:\s*/gi, '')
    .replace(/"passoAPasso"\s*:\s*/gi, '')
    .replace(/"atencao"\s*:\s*/gi, '')
    .replace(/"quandoPedirAjuda"\s*:\s*/gi, '')
    .replace(/[{}\[\]"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarRespostaIA(dados) {
  const r = dados?.resposta || dados || {};

  const respostaSimples = limparTextoExibicao(r.respostaSimples || '');
  const atencao = limparTextoExibicao(r.atencao || '');
  const quandoPedirAjuda = limparTextoExibicao(r.quandoPedirAjuda || '');

  let passoAPasso = Array.isArray(r.passoAPasso)
    ? r.passoAPasso.map((p) => limparTextoExibicao(p)).filter(Boolean)
    : [];

  if (!passoAPasso.length) {
    const limpezaGeral = limparTextoExibicao(typeof r === 'string' ? r : JSON.stringify(r));
    passoAPasso = limpezaGeral ? [limpezaGeral] : ['Siga com calma e peça ajuda se houver dúvida.'];
  }

  return {
    respostaSimples: respostaSimples || 'Vamos resolver isso com calma.',
    passoAPasso,
    atencao: atencao || 'Cuidado com dados pessoais e financeiros.',
    quandoPedirAjuda: quandoPedirAjuda || 'Peça ajuda se houver risco, dinheiro ou links suspeitos.'
  };
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

    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok || dados?.fallback === true) throw new Error('IA indisponível');
    return normalizarRespostaIA(dados);
  } finally {
    clearTimeout(timer);
  }
}
