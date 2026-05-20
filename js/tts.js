function ouvirTexto(texto) {
  if (!('speechSynthesis' in window)) {
    alert('Seu navegador não suporta leitura de voz.');
    return;
  }
  const utter = new SpeechSynthesisUtterance(texto);
  utter.lang = 'pt-BR';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}
