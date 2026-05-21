let vozesDisponiveis = [];

function carregarVozes() {
  if (!('speechSynthesis' in window)) return;
  vozesDisponiveis = window.speechSynthesis.getVoices() || [];
}

function obterMelhorVoz() {
  if (!('speechSynthesis' in window)) return null;
  if (!vozesDisponiveis.length) carregarVozes();

  const pontuarVoz = (voz) => {
    const lang = (voz.lang || '').toLowerCase();
    const nome = (voz.name || '').toLowerCase();
    let pontos = 0;

    if (lang === 'pt-br' || lang.startsWith('pt-br')) pontos += 100;
    else if (lang === 'pt-pt' || lang.startsWith('pt-pt')) pontos += 80;
    else if (lang.startsWith('pt')) pontos += 60;

    if (voz.default) pontos += 5;
    if (nome.includes('neural') || nome.includes('natural')) pontos += 12;
    if (nome.includes('google') || nome.includes('microsoft') || nome.includes('luciana') || nome.includes('fernanda')) pontos += 8;
    if (nome.includes('espeak') || nome.includes('robot')) pontos -= 15;

    return pontos;
  };

  const melhor = [...vozesDisponiveis].sort((a, b) => pontuarVoz(b) - pontuarVoz(a))[0];
  return melhor || null;
}

function limparTextoParaLeitura(texto = '') {
  const semTags = String(texto).replace(/<[^>]+>/g, ' ');
  return semTags.replace(/\s+/g, ' ').trim();
}

function falarTexto(texto) {
  if (!('speechSynthesis' in window)) {
    alert('Seu navegador não suporta leitura de voz.');
    return;
  }

  const textoLimpo = limparTextoParaLeitura(texto);
  if (!textoLimpo) return;

  const utter = new SpeechSynthesisUtterance(textoLimpo);
  const melhorVoz = obterMelhorVoz();

  if (melhorVoz) {
    utter.voice = melhorVoz;
    utter.lang = melhorVoz.lang || 'pt-BR';
  } else {
    utter.lang = 'pt-BR';
  }

  utter.rate = 0.9;
  utter.pitch = 1.0;
  utter.volume = 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

window.ouvirTexto = falarTexto;

if ('speechSynthesis' in window) {
  carregarVozes();
  window.speechSynthesis.onvoiceschanged = carregarVozes;
}
