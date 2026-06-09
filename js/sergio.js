const termosSensiveis = [];

const frasesVagas = [
  'boa', 'bom dia', 'boa tarde', 'boa noite',
  'oi', 'olá', 'ola', 'tenho uma dúvida', 'tenho uma duvida', 'me ajuda', 'ajuda',
  'não sei mexer', 'nao sei mexer', 'queria perguntar uma coisa', 'dúvida', 'duvida',
  'ola gostaria de tirar uma duvida'
];

const termosIntencaoDigital = new Set([
  'facebook', 'instagram', 'messenger', 'conversar', 'amiga', 'amigo', 'mensagem',
  'foto', 'perfil', 'abrir', 'apagar', 'enviar', 'receber', 'camera', 'câmera',
  'volume', 'print', 'wifi', 'wi-fi', 'email', 'e-mail', 'aplicativo', 'app',
  'celular', 'whatsapp', 'ligacao', 'ligação'
]);

const termosGenericos = new Set([
  'duvida', 'dúvida', 'ajuda', 'celular', 'aplicativo', 'app', 'whatsapp', 'internet',
  'coisa', 'mexer', 'ola', 'olá', 'oi', 'tenho', 'queria', 'perguntar', 'sobre'
]);

function normalizarTexto(texto = '') {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function escaparHtml(texto = '') {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function limparCampoRender(texto = '') {
  return String(texto)
    .replace(/```json|```/gi, ' ')
    .replace(/[{}\[\]"]/g, ' ')
    .replace(/\\[nrt]/g, ' ')
    .replace(/\\/g, ' ')
    .replace(/\b(resposta\s*simples|respostasimples|passo\s*a\s*passo|passoapasso|atencao|aten[cç][aã]o|quando\s*pedir\s*ajuda|quandopedirajuda|alerta\s*humano|alertahumano)\s*[:=-]?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizarResposta(item = {}) {
  const passos = Array.isArray(item.passoAPasso) ? item.passoAPasso : String(item.passoAPasso || '').split(/\n|\s*\d+[).:-]\s*/);
  const resposta = {
    respostaSimples: limparCampoRender(item.respostaSimples),
    passoAPasso: passos.map((p) => limparCampoRender(p)).filter(Boolean).slice(0, 6),
    atencao: limparCampoRender(item.atencao),
    alertaHumano: limparCampoRender(item.alertaHumano),
    quandoPedirAjuda: limparCampoRender(item.quandoPedirAjuda),
    opcoesFluxo: Array.isArray(item.opcoesFluxo) ? item.opcoesFluxo.map((o) => limparCampoRender(o)).filter(Boolean).slice(0, 8) : []
  };
  const primeiroPasso = normalizarTexto(resposta.passoAPasso[0] || '');
  const respostaNorm = normalizarTexto(resposta.respostaSimples);
  if (primeiroPasso && respostaNorm && (primeiroPasso.includes(respostaNorm) || respostaNorm.includes(primeiroPasso))) resposta.passoAPasso = resposta.passoAPasso.slice(1);
  return resposta;
}

function detectarApoioVisual(resposta = '', pergunta = '', tipo = '') {
  const base = normalizarTexto(`${resposta} ${pergunta} ${tipo}`);
  const pedidoDinheiro = /(pedindo|pediu|pediram|pede|pedir|pedido).{0,24}(dinheiro|pix|transferencia|valor)|(?:dinheiro|pix|transferencia|valor).{0,24}(urgente|agora|rapido)/.test(base);
  const familiarFalso = /(foto|nome|numero novo|outro numero).{0,36}(filho|filha|irmao|irma|mae|pai|familiar|parente)|(?:filho|filha|irmao|irma|mae|pai|familiar|parente).{0,36}(foto|nome|numero novo|outro numero)/.test(base);
  const linkSuspeito = /(link).{0,28}(estranho|suspeito|promocao|premio|desconhecido|whatsapp)|(?:estranho|suspeito|promocao|premio|desconhecido).{0,28}(link)/.test(base);
  const golpeExplicito = /\bgolpe\b|numero desconhecido|numero novo/.test(base);

  if (pedidoDinheiro || familiarFalso || linkSuspeito || golpeExplicito) {
    return { emoji: '🛡️', titulo: 'Cuidado com golpe' };
  }

  const senhaConta = /(senha|recuperar senha|recuperar conta|login|codigo de verificacao|acesso ao whatsapp|acesso ao facebook|acesso ao instagram|gov\.br|banco.{0,20}senha|senha.{0,20}banco|entrar.{0,20}(whatsapp|facebook|instagram|gov\.br|banco)|acesso.{0,20}(whatsapp|facebook|instagram|gov\.br|banco))/.test(base);
  if (senhaConta) {
    return { emoji: '🔐', titulo: 'Senha e conta' };
  }

  const regras = [
    { termos: ['pix', 'banco', 'dinheiro'], emoji: '💳', titulo: 'Banco e Pix' },
    { termos: ['volume', 'som', 'audio', 'wifi', 'wi-fi', 'print', 'celular'], emoji: '📱', titulo: 'Celular' },
    { termos: ['whatsapp'], emoji: '🟢', titulo: 'WhatsApp' },
    { termos: ['facebook', 'messenger'], emoji: '💬', titulo: 'Facebook/Messenger' },
    { termos: ['golpe', 'link', 'suspeito', 'urgente'], emoji: '🛡️', titulo: 'Cuidado com golpe' },
    { termos: ['loja', 'site', 'compra'], emoji: '🛒', titulo: 'Verifique antes de comprar' },
    { termos: ['receita', 'dia a dia', 'cozinha'], emoji: '📝', titulo: 'Dica do dia a dia' }
  ];
  return regras.find((regra) => regra.termos.some((termo) => base.includes(termo))) || null;
}

function montarResposta(item, pergunta = '') {
  const limpo = sanitizarResposta(item);
  const apoio = detectarApoioVisual(limpo.respostaSimples, pergunta, item.categoria || '');
  const passosHtml = limpo.passoAPasso.length ? limpo.passoAPasso.map((p, i) => `<div class="passo-card"><span class="passo-numero">${i + 1}</span><span class="passo-texto">${escaparHtml(p)}</span></div>`).join('') : '';
  const opcoesHtml = limpo.opcoesFluxo.length ? `<div class="chips-sergio-fluxo">${limpo.opcoesFluxo.map((opcao) => `<button type="button" class="chip-sergio" data-flow-option="${escaparHtml(opcao)}">${escaparHtml(opcao)}</button>`).join('')}</div>` : '';
  const texto = `Resposta simples: ${limpo.respostaSimples}\n${limpo.passoAPasso.length ? `Passo a passo: ${limpo.passoAPasso.join(' ')}\n` : ''}${limpo.atencao ? `Atenção: ${limpo.atencao}\n` : ''}${limpo.alertaHumano ? `Alerta humano: ${limpo.alertaHumano}\n` : ''}${limpo.quandoPedirAjuda ? `Quando pedir ajuda: ${limpo.quandoPedirAjuda}` : ''}`.trim();
  return {
    html: `<div class="bloco-sergio">
      ${apoio ? `<div class="apoio-visual" data-asset-path="assets/guias/"><strong>${apoio.emoji}</strong><span>${escaparHtml(apoio.titulo)}</span></div>` : ''}
      <p class="resposta-destaque">${escaparHtml(limpo.respostaSimples)}</p>
      ${passosHtml ? `<div class="passos-sergio">${passosHtml}</div>` : ""}
      ${limpo.atencao ? `<p class="caixa-atencao"><strong>Atenção:</strong> ${escaparHtml(limpo.atencao)}</p>` : ""}
      ${limpo.alertaHumano ? `<p class="caixa-alerta-humano">${escaparHtml(limpo.alertaHumano)}</p>` : ""}
      ${limpo.quandoPedirAjuda ? `<p class="caixa-ajuda"><strong>Quando pedir ajuda:</strong> ${escaparHtml(limpo.quandoPedirAjuda)}</p>` : ""}
      ${opcoesHtml}
    </div>`,
    texto
  };
}

function initMicrofone() {
  // Modo Voz Beta usa gravação WAV real em js/app.js e transcrição no backend.
}

