function filtrarFaq(faq, termo) {
  const t = termo.toLowerCase().trim();
  if (!t) return [];
  return faq
    .map(item => ({ item, score: pontuacaoFaq(item, t) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.item);
}
