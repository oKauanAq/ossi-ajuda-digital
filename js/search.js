function filtrarFaq(faq, termo) {
  const t = termo.toLowerCase().trim();
  if (!t) return [];
  return faq.filter(item =>
    item.pergunta.toLowerCase().includes(t) ||
    item.categoria.toLowerCase().includes(t) ||
    item.respostaSimples.toLowerCase().includes(t)
  );
}
