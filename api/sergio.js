const MODELO_PADRAO = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
const MODELO_NVIDIA = process.env.NVIDIA_MODEL || MODELO_PADRAO;

const TIPOS_PUBLICOS = {
  saudacao_ou_vaga: 'saudacao_ou_vaga',
  duvida_geral: 'duvida_geral',
  duvida_digital: 'duvida_digital',
  seguranca: 'seguranca',
  consulta_loja_site: 'consulta_loja_site',
  fallback: 'fallback'
};

const ALERTA_HUMANO = '⚠️ Essa situação é arriscada. Antes de enviar dinheiro, senha ou código, fale pessoalmente com um familiar de confiança ou peça ajuda na Obra Social Santa Isabel.';
const CAMPOS_RESPOSTA = ['respostaSimples', 'passoAPasso', 'atencao', 'quandoPedirAjuda', 'alertaHumano', 'opcoesFluxo'];
const PALAVRAS_FINAIS_TRUNCADAS = new Set(['por', 'para', 'com', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'se', 'que', 'porque', 'quando', 'caso', 'for']);
const RESPOSTA_TRUNCADA_FALLBACK = 'Desculpe, minha resposta anterior pode ter saído incompleta. Não faça nada com pressa e peça ajuda a alguém de confiança antes de continuar.';

function aplicarCorrecoesComuns(t = '') {
  let texto = t;
  const substituicoes = [
    [/\b(?:whastapp|whatsa+p+|whatsap+|whatss?ap+|watsap+|zap)\b/g, 'whatsapp'],
    [/\bface\b/g, 'facebook'],
    [/\bgov\s*br\b/g, 'gov.br'],
    [/\bminhas senha\b/g, 'minha senha'],
    [/\besqueci minhas senha\b/g, 'esqueci minha senha'],
    [/\b(?:pics|piks|pique)\b/g, 'pix'],
    [/\blink\s+(?:extra|estra|estranha|suspeita)\b/g, 'link estranho'],
    [/\bseguranca\b/g, 'seguranca'],
    [/\bcodigo\b/g, 'codigo'],
    [/\bestam\b/g, 'estao']
  ];
  substituicoes.forEach(([padrao, valor]) => { texto = texto.replace(padrao, valor); });
  if (/\b(senha|conta|entrar|recuperar|esqueci|login|acesso)\b/.test(texto)) {
    texto = texto.replace(/\bminha senhora\b/g, 'minha senha');
  }
  return texto;
}

function normalizarTexto(texto = '') {
  return aplicarCorrecoesComuns(String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”‘’]/g, '"')
    .replace(/[^\p{L}\p{N}.@\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim())
    .replace(/\s+/g, ' ')
    .trim();
}

function limparCampoResposta(valor = '') {
  const limpo = String(valor)
    .replace(/```json|```/gi, ' ')
    .replace(/[{}[\]"]/g, ' ')
    .replace(/\\[nrt]/g, ' ')
    .replace(/\\/g, ' ')
    .replace(/\b(resposta\s*simples|respostasimples|passo\s*a\s*passo|passoapasso|atencao|aten[cç][aã]o|quando\s*pedir\s*ajuda|quandopedirajuda|alerta\s*humano|alertahumano)\s*[:=-]?/gi, ' ')
    .replace(/^\s*\d+[.)-]\s*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/,\s*$/, '.')
    .trim();

  if (limpo.length <= 700) return limpo;
  const limiteSeguro = limpo.slice(0, 700);
  const fimFrase = Math.max(limiteSeguro.lastIndexOf('.'), limiteSeguro.lastIndexOf('!'), limiteSeguro.lastIndexOf('?'));
  if (fimFrase >= 120) return limiteSeguro.slice(0, fimFrase + 1).trim();
  return limiteSeguro.replace(/\s+\S*$/, '').trim().replace(/[,:;\-–—]+$/, '').trim() + '.';
}


function limparPontuacao(texto = '') {
  return String(texto)
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([.!?])\s*,\s*/g, '$1 ')
    .replace(/,\s*(?=(?:abra|toque|clique|acesse|procure|confira|escolha|digite|entre|va|vá|depois|em seguida|por fim)\b)/gi, '. ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.!?])/g, '$1')
    .replace(/([.!?]){2,}/g, '$1')
    .trim();
}

function limitarRespostaSimples(texto = '') {
  const limpo = limparPontuacao(texto);
  const frases = limpo.match(/[^.!?]+[.!?]?/g) || [];
  if (frases.length <= 2) return limpo;
  return frases.slice(0, 2).join(' ').trim().replace(/[,:;\-–—]+$/, '').trim();
}

function extrairPassosDeTexto(texto = '') {
  const limpo = limparPontuacao(texto);
  const comQuebras = limpo
    .replace(/\b(\d{1,2})[.)-]\s*/g, '\n$1. ')
    .replace(/\s+(?=(?:abra|toque|clique|acesse|procure|confira|escolha|digite|entre|va|vá|depois|em seguida|por fim)\b)/gi, '\n');
  return comQuebras
    .split(/\n+|\s*;\s*/)
    .map((p) => limparCampoResposta(p).replace(/^\d+[.)-]\s*/, ''))
    .filter((p) => p.split(/\s+/).length >= 2)
    .slice(0, 6);
}

function pareceRespostaTruncada(texto = '') {
  const limpo = String(texto).trim();
  if (!limpo) return false;
  const ultimaPalavra = normalizarTexto(limpo).split(' ').filter(Boolean).at(-1) || '';
  if (PALAVRAS_FINAIS_TRUNCADAS.has(ultimaPalavra)) return true;
  if (/\b(?:veio por|se for|caso|quando|com)$/i.test(limpo)) return true;
  const temTamanhoDeFrase = limpo.split(/\s+/).length >= 8;
  return temTamanhoDeFrase && !/[.!?…]$/.test(limpo);
}

function garantirRespostaCompleta(texto = '', fallback = RESPOSTA_TRUNCADA_FALLBACK) {
  const limpo = limparCampoResposta(texto);
  if (pareceRespostaTruncada(limpo)) return fallback;
  return limpo;
}

function respostaPadrao(resposta = {}, defaults = {}) {
  const passosVistos = new Set();
  const passosOriginais = Array.isArray(resposta.passoAPasso)
    ? resposta.passoAPasso.map((p) => limparPontuacao(limparCampoResposta(p))).filter(Boolean)
    : [];
  const respostaLimpa = garantirRespostaCompleta(resposta.respostaSimples || defaults.respostaSimples || 'Não consegui entender bem. Pode perguntar de outro jeito?', defaults.respostaSimples || RESPOSTA_TRUNCADA_FALLBACK);
  const passosExtraidos = passosOriginais.length ? [] : extrairPassosDeTexto(respostaLimpa).slice(1);
  const passos = [...passosOriginais, ...passosExtraidos]
    .filter((p) => {
      const chave = normalizarTexto(p);
      if (!chave || passosVistos.has(chave)) return false;
      passosVistos.add(chave);
      return true;
    }).slice(0, 6);

  return {
    respostaSimples: limitarRespostaSimples(respostaLimpa),
    passoAPasso: passos,
    atencao: limparPontuacao(limparCampoResposta(resposta.atencao || defaults.atencao || '')),
    alertaHumano: limparPontuacao(limparCampoResposta(resposta.alertaHumano || defaults.alertaHumano || '')),
    quandoPedirAjuda: limparPontuacao(limparCampoResposta(resposta.quandoPedirAjuda || defaults.quandoPedirAjuda || '')),
    opcoesFluxo: Array.isArray(resposta.opcoesFluxo) ? resposta.opcoesFluxo.map((o) => limparPontuacao(limparCampoResposta(o))).filter(Boolean).slice(0, 8) : []
  };
}
const pacote = (tipo, resposta, origem, metadados = {}) => ({ tipo, resposta: respostaPadrao(resposta), origem, ...metadados });

const RESPOSTAS = {
  incompreensivel: {
    respostaSimples: 'Não entendi bem. Pode repetir com calma?',
    passoAPasso: ['Fale uma frase curta.', 'Diga o nome do aplicativo, como WhatsApp, Instagram, banco ou celular.', 'Se preferir, escreva sua dúvida.'],
    atencao: 'Não fale senha, código, CPF ou dados do banco.',
    quandoPedirAjuda: 'Peça ajuda se for sobre dinheiro, senha ou golpe.'
  },
  dados_sensiveis: {
    respostaSimples: 'Por segurança, não compartilhe senha, código, CPF completo, cartão, documento, foto de documento ou chave de banco aqui.',
    passoAPasso: ['Apague esses dados da conversa se puder.', 'Não envie esses dados por WhatsApp, ligação ou link.', 'Use apenas o aplicativo oficial do serviço.', 'Peça ajuda a alguém de confiança se alguém pediu esses dados.'],
    atencao: 'Nenhum atendimento seguro precisa receber sua senha completa ou código de SMS por mensagem.',
    alertaHumano: ALERTA_HUMANO,
    quandoPedirAjuda: 'Peça ajuda imediatamente se você já enviou senha, código, cartão, documento ou CPF completo para alguém.'
  },
  risco_real: {
    respostaSimples: 'Não faça pagamento nem envie dados agora. Essa situação pode ser golpe e precisa ser confirmada com calma.',
    passoAPasso: ['Pare antes de fazer Pix, transferência ou clicar em link.', 'Confirme a história por um número antigo ou canal que você já conhece.', 'Fale com outro familiar ou pessoa de confiança.', 'Não envie senha, código, CPF, cartão ou documento.', 'Se continuar em dúvida, peça ajuda na Obra Social Santa Isabel.'],
    atencao: 'Golpistas usam pressa, foto de familiar, número novo ou pedido de segredo para enganar.',
    alertaHumano: ALERTA_HUMANO,
    quandoPedirAjuda: 'Peça ajuda antes de enviar qualquer dinheiro ou dado pessoal.'
  },
  pix_seguro: {
    respostaSimples: 'Você pode fazer Pix com mais segurança usando somente o aplicativo oficial do banco e conferindo tudo antes de confirmar.',
    passoAPasso: ['Abra apenas o aplicativo oficial do seu banco.', 'Entre na área Pix.', 'Digite a chave, leia o QR Code ou escolha o contato com calma.', 'Confira nome, banco e valor antes de confirmar.', 'Digite sua senha somente dentro do aplicativo oficial.', 'Guarde o comprovante.'],
    atencao: 'Se o pedido veio com urgência, número novo, ameaça ou história estranha, pare e confirme antes.',
    quandoPedirAjuda: 'Peça ajuda antes de Pix alto, urgente ou para pessoa desconhecida.'
  },
  duvida_digital: {
    respostaSimples: 'Posso ajudar com essa dúvida digital. Diga se você usa Android, iPhone ou computador para eu orientar melhor.',
    passoAPasso: ['Abra o aplicativo ou configuração relacionada.', 'Procure por Perfil, Conta, Ajustes, Configurações ou Ajuda.', 'Leia a tela com calma antes de tocar em confirmar.', 'Se aparecer senha, código, Pix ou link estranho, pare e peça ajuda.'],
    atencao: 'Nunca envie senha, código, CPF, cartão ou documento para outras pessoas.',
    opcoesFluxo: ['Android', 'iPhone', 'Computador', 'WhatsApp', 'Instagram']
  },
  geral: {
    respostaSimples: 'Posso responder de forma simples. Se for sobre a Obra Social Santa Isabel, confirme informações oficiais diretamente com alguém da instituição.',
    passoAPasso: [],
    atencao: 'Se aparecer pedido de dinheiro, senha, código ou link estranho, trate como risco.'
  },
  institucional: {
    respostaSimples: 'Este sistema é o OSSI Ajuda Digital, criado para apoiar pessoas idosas com dúvidas digitais na Obra Social Santa Isabel.',
    passoAPasso: ['Ele reúne uma central de ajuda e o assistente Sérgio.', 'O objetivo é orientar com linguagem simples e cuidado com golpes.', 'Para informações institucionais, confirme diretamente com a Obra Social Santa Isabel.'],
    atencao: 'Para informações oficiais, confirme diretamente com a Obra Social Santa Isabel.'
  },
  mark: {
    respostaSimples: 'Mark Zuckerberg é um empresário de tecnologia conhecido por cofundar o Facebook e por liderar a Meta, empresa ligada ao Facebook, Instagram e WhatsApp.',
    passoAPasso: [],
    atencao: 'Essa é uma explicação geral. Para dados atuais, confirme em uma fonte confiável.'
  },
  internet: {
    respostaSimples: 'Internet é uma grande rede que conecta celulares, computadores e serviços no mundo todo para trocar mensagens, ver sites, vídeos e informações.',
    passoAPasso: ['Você usa a internet quando abre WhatsApp, sites, vídeos ou aplicativos online.', 'Ela pode vir pelo Wi‑Fi da casa ou pelos dados móveis do celular.', 'Use com cuidado: não clique em links estranhos nem envie dados pessoais.']
  },
  bob: {
    respostaSimples: 'Bob Esponja é um personagem de desenho animado. Ele é uma esponja amarela que vive no fundo do mar, na cidade fictícia Fenda do Biquíni.',
    passoAPasso: []
  }
};

const GUIAS_LOCAIS = {
  tecnologia: {
    id: 'tecnologia', categoria: TIPOS_PUBLICOS.duvida_digital, risco: 'baixo',
    contexto: 'Dúvidas comuns de celular, computador, WhatsApp, Instagram, aplicativos, fotos, configurações, atualização e treino digital. O local só orienta; a IA deve responder a pergunta específica.',
    passosSugeridos: ['identificar aplicativo ou aparelho', 'dar passos curtos', 'pedir Android, iPhone ou computador quando isso mudar o caminho', 'alertar para não compartilhar dados sensíveis'],
    regrasSeguranca: ['não pedir senha, código, CPF completo, cartão ou documento', 'não mandar instalar app fora de loja oficial', 'não sugerir clicar em link suspeito'],
    nuncaFazer: ['transformar toda dúvida digital em golpe', 'responder com bloco pronto que ignore a pergunta específica'],
    alertaHumanoPadrao: '', fallbackLocal: RESPOSTAS.duvida_digital
  },
  pix_seguro: {
    id: 'pix_seguro', categoria: TIPOS_PUBLICOS.seguranca, risco: 'medio',
    contexto: 'Orientação preventiva para fazer Pix com segurança quando não há golpe explícito.',
    passosSugeridos: ['usar aplicativo oficial do banco', 'conferir nome, banco e valor', 'parar em caso de urgência, número novo ou desconhecido', 'guardar comprovante'],
    regrasSeguranca: ['não recomendar Pix se houver dúvida de identidade', 'senha apenas dentro do aplicativo oficial', 'não pedir chave bancária do usuário'],
    nuncaFazer: ['pedir senha', 'orientar pagamento com pressa'],
    alertaHumanoPadrao: '', fallbackLocal: RESPOSTAS.pix_seguro
  },
  risco_real: {
    id: 'risco_real', categoria: TIPOS_PUBLICOS.seguranca, risco: 'alto',
    contexto: 'Pedido de dinheiro, Pix urgente, link suspeito, banco, número desconhecido, familiar falso, CPF/cartão/documento ou golpe provável.',
    passosSugeridos: ['não enviar dinheiro', 'não clicar em links', 'confirmar por número antigo ou canal conhecido', 'falar com outro familiar', 'pedir ajuda na Obra Social Santa Isabel'],
    regrasSeguranca: ['manter alertaHumano', 'bloquear orientação de pagamento', 'não pedir senha/código/CPF/cartão/documento', 'não confiar apenas em foto, voz, nome ou número novo'],
    nuncaFazer: ['recomendar Pix, transferência ou pagamento', 'remover alerta humano', 'mandar clicar em link suspeito'],
    alertaHumanoPadrao: ALERTA_HUMANO, fallbackLocal: RESPOSTAS.risco_real
  },
  dado_sensivel: {
    id: 'dado_sensivel', categoria: TIPOS_PUBLICOS.seguranca, risco: 'critico',
    contexto: 'O usuário compartilhou senha, código, CPF completo, cartão, documento ou dado bancário. A resposta deve ser local imediata.',
    passosSugeridos: ['interromper', 'orientar apagar dados', 'não repetir dados', 'pedir ajuda se dados foram enviados a terceiros'],
    regrasSeguranca: ['nunca processar, guardar ou repetir o dado sensível'],
    nuncaFazer: ['chamar IA com o dado sensível'], alertaHumanoPadrao: ALERTA_HUMANO, fallbackLocal: RESPOSTAS.dados_sensiveis
  },
  geral: {
    id: 'geral', categoria: TIPOS_PUBLICOS.duvida_geral, risco: 'baixo',
    contexto: 'Perguntas gerais. A IA responde em linguagem simples, sem inventar dados institucionais e sem web.',
    passosSugeridos: ['responder direto', 'explicar termos difíceis', 'se for sobre instituição, ser honesto sobre limites'],
    regrasSeguranca: ['não transformar pergunta geral em golpe sem sinal real'],
    nuncaFazer: ['inventar autoria do sistema', 'fornecer dados atuais não confirmados como definitivos'], alertaHumanoPadrao: '', fallbackLocal: RESPOSTAS.geral
  }
};


const ICONES_APLICATIVOS = {
  whatsapp: 'ícone verde com um telefone branco',
  facebook: 'ícone azul com a letra F',
  instagram: 'ícone colorido com desenho de câmera',
  youtube: 'ícone vermelho com botão de play',
  messenger: 'ícone de conversa azul, roxo ou branco',
  banco: 'ícone com o nome ou símbolo do seu banco',
  'gov.br': 'ícone oficial do Gov.br',
  generico: 'ícone com o nome do aplicativo'
};

const NOMES_APLICATIVOS = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  messenger: 'Messenger',
  banco: 'aplicativo do banco',
  'gov.br': 'Gov.br',
  pix: 'aplicativo do banco',
  documento: 'aplicativo de documento',
  saude: 'aplicativo de saúde',
  generico: 'aplicativo'
};

function detectarAppReconhecido(texto = '') {
  const t = normalizarTexto(texto);
  if (/\bwhatsapp\b/.test(t)) return 'whatsapp';
  if (/\bfacebook\b/.test(t)) return 'facebook';
  if (/\binstagram\b/.test(t)) return 'instagram';
  if (/\byoutube\b/.test(t)) return 'youtube';
  if (/\bmessenger\b/.test(t)) return 'messenger';
  if (/\bgov\.br\b|\bgovbr\b/.test(t)) return 'gov.br';
  if (/\bpix\b/.test(t)) return 'pix';
  if (/\bbanco\b|\bcaixa\b|\bitau\b|\bbradesco\b|\bsantander\b|\bnubank\b|\bbanco do brasil\b/.test(t)) return 'banco';
  if (/\bdocumento\b|\brg\b|\bcnh\b|\bcarteira digital\b/.test(t)) return 'documento';
  if (/\bsaude\b|\bsus\b/.test(t)) return 'saude';
  if (/\b(app|aplicativo)\b/.test(t)) return 'generico';
  return '';
}

function ehIntencaoAbrirOuEncontrarAplicativo(texto = '') {
  const t = normalizarTexto(texto);
  const temAcaoDireta = /\b(?:abrir|abro)\s+(?:o\s+|a\s+)?(?:app|aplicativo)\b/.test(t)
    || /\b(?:abrir|abro)\s+(?:o\s+|a\s+)?(?:facebook|whatsapp|instagram|youtube|messenger|banco|gov\.br|govbr|pix)\b/.test(t)
    || /\b(?:quero|preciso)\s+(?:abrir|abro)\b/.test(t)
    || /\bcomo\s+(?:abrir|abro)\b/.test(t)
    || /\b(?:encontrar|procurar)\s+(?:o\s+|a\s+)?(?:app|aplicativo)\b/.test(t);
  const temNaoAcho = /\b(?:nao acho|nao estou achando|nao to achando|nao encontro|sumiu|cade)\b/.test(t);
  const temApp = Boolean(detectarAppReconhecido(t));
  return temApp && (temAcaoDireta || temNaoAcho);
}

function appSensivel(app = '') {
  return ['banco', 'pix', 'gov.br', 'documento', 'saude'].includes(app);
}

function responderAbrirAplicativoUniversal(app = 'generico') {
  const chave = app || 'generico';
  const nome = NOMES_APLICATIVOS[chave] || NOMES_APLICATIVOS.generico;
  const descricaoIcone = ICONES_APLICATIVOS[chave] || ICONES_APLICATIVOS.generico;
  const sensivel = appSensivel(chave);
  return {
    respostaSimples: `Para abrir o ${nome}, procure o ícone do aplicativo na tela do celular. Se não encontrar, use a busca do celular e digite ${nome}.`,
    passoAPasso: [
      'Desbloqueie o celular.',
      `Procure o ícone do ${nome} na tela inicial.`,
      'Se não encontrar, deslize para ver outras telas.',
      `Use a busca do celular e digite ${nome}.`,
      `Confira se o ícone parece com ${descricaoIcone}.`,
      'Toque no aplicativo para abrir.',
      'Se não aparecer, talvez ele não esteja instalado. Peça ajuda antes de baixar qualquer aplicativo.'
    ],
    atencao: sensivel
      ? 'Abra apenas o aplicativo oficial. Não instale aplicativo por link recebido em mensagem. Nunca envie senha, código, CPF, cartão ou documento para outras pessoas.'
      : 'Nunca envie senha, código, CPF, cartão ou documento para outras pessoas.',
    quandoPedirAjuda: sensivel
      ? 'Peça ajuda se tiver dúvida se o aplicativo é oficial.'
      : 'Peça ajuda se o aplicativo não aparecer, se pedir pagamento, se vier por link ou se você não tiver certeza de que é o aplicativo oficial.'
  };
}

function detectarPedidoAbrirAplicativo(pergunta = '') {
  if (!ehIntencaoAbrirOuEncontrarAplicativo(pergunta)) return null;
  return { app: detectarAppReconhecido(pergunta) || 'generico' };
}

function detectarPedidoAbrirAplicativoPendente(historico = []) {
  return [...(Array.isArray(historico) ? historico : [])]
    .reverse()
    .filter((m) => m?.role === 'user' && typeof m.content === 'string')
    .map((m) => detectarPedidoAbrirAplicativo(m.content))
    .find(Boolean) || null;
}

function ehRespostaCurtaDeDispositivoOuDuvida(pergunta = '') {
  const t = normalizarTexto(pergunta);
  return /^(?:eu\s+)?(?:uso\s+)?android(?:\s+me ajude)?$/.test(t)
    || /^(?:eu\s+)?(?:uso\s+)?iphone(?:\s+me ajude)?$/.test(t)
    || /^(?:eu\s+)?(?:uso\s+)?(?:computador|pc|notebook)(?:\s+me ajude)?$/.test(t)
    || /^(?:eu\s+)?nao sei(?: qual e| o que e isso| o que e android)?$/.test(t)
    || /^(?:eu\s+)?nao entendi$/.test(t);
}

const PACOTES_ORIENTACAO = GUIAS_LOCAIS;

const INTENCOES = [
  { id: 'guia_tecnologia', tipo: TIPOS_PUBLICOS.duvida_digital, guia: 'tecnologia' },
  { id: 'pix_seguro', tipo: TIPOS_PUBLICOS.seguranca, guia: 'pix_seguro' },
  { id: 'risco_real', tipo: TIPOS_PUBLICOS.seguranca, guia: 'risco_real' },
  { id: 'dado_sensivel', tipo: TIPOS_PUBLICOS.seguranca, guia: 'dado_sensivel' },
  { id: 'duvida_geral', tipo: TIPOS_PUBLICOS.duvida_geral, guia: 'geral' }
];

function temDadoPessoal(texto = '') {
  const t = normalizarTexto(texto);
  return /(\b\d{11}\b|\b\d{16}\b|\b\d{3}[.-]?\d{3}[.-]?\d{3}-?\d{2}\b|\b(?:senha|codigo|token|cartao|cpf|rg|documento|chave pix|agencia|conta)\b)/i.test(t);
}

function contemDadoSensivelCompartilhado(texto = '') {
  const original = String(texto);
  const t = normalizarTexto(original);
  return /\b(minha|meu|o meu|a minha)\s+(senha|codigo|token|cpf|cartao|documento|rg|chave pix|conta|agencia)\s+(?:e|é|eh|:)/i.test(original)
    || /\b(cpf|cartao|cartão|senha|codigo|código|token)\b\D{0,20}\d{4,}/i.test(original)
    || /\b\d{3}[.-]?\d{3}[.-]?\d{3}-?\d{2}\b/.test(t)
    || /\b\d{13,16}\b/.test(t);
}

function contemRiscoReal(texto = '') {
  const t = normalizarTexto(texto);
  const dinheiro = /\b(dinheiro|pix|pagamento|pagar|transferencia|boleto|deposito|reais?)\b/.test(t);
  const pedido = /\b(pediram|pediu|pedindo|mandaram|mensagem|ligando|ligaram|numero novo|numero desconhecido|desconhecido|urgente|valor alto|trinta mil|tres mil|3000|30 mil)\b/.test(t);
  const familiar = /\b(filho|filha|sobrinho|sobrinha|neto|neta|mae|pai|irmao|irma|tio|tia|familiar|parente|foto|parece|cara)\b/.test(t);
  const golpe = /\b(golpe|link estranho|link suspeito|cliquei em um link|loja confiavel|site confiavel|preco muito barato|número desconhecido|numero desconhecido)\b/.test(t);
  const bancoSensivel = /\b(banco|cartao|cpf|documento|senha|codigo|token)\b/.test(t) && /\b(pediram|pediu|mandaram|ligando|desconhecido|link|mensagem)\b/.test(t);
  return (dinheiro && (pedido || familiar)) || golpe || bancoSensivel;
}

function contemTermoRisco(texto = '') {
  return contemRiscoReal(texto) || /\b(senha|codigo|token|cpf|cartao|documento|banco|pix|dinheiro|golpe|link estranho|link suspeito)\b/.test(normalizarTexto(texto));
}

function ehPerguntaPixSeguro(t = '') {
  return /\bpix\b/.test(t) && /\b(como|fazer|seguranca|seguro|enviar|transferir|pagar)\b/.test(t) && !contemRiscoReal(t);
}

function ehDuvidaDigital(t = '') {
  return /\b(whatsapp|instagram|facebook|youtube|celular|telefone|android|iphone|computador|notebook|app|aplicativo|foto|perfil|volume|som|wi-fi|wifi|print|tela|atualizar|apagar|instalar|desinstalar|mensagem|audio|video|exercicios|treinar)\b/.test(t);
}

function ehPerguntaCompletaClara(pergunta = '') {
  const t = normalizarTexto(pergunta);
  if (!t) return false;
  const palavras = t.split(' ').filter(Boolean);
  if (/\b(confirmar|confirmo|confiar)\b/.test(t) && /\b(ele|ela|isso|sobrinho|filho|familiar|parente)\b/.test(t)) return false;
  const temAcao = /\b(como|abrir|mudar|trocar|alterar|aumentar|diminuir|atualizar|apagar|desinstalar|instalar|entrar|acessar|recuperar|quem|o que|qual)\b/.test(t);
  const temAssunto = /\b(facebook|instagram|whatsapp|youtube|foto|perfil|volume|som|computador|notebook|aplicativo|app|internet|mark zuckerberg|celular|android|iphone)\b/.test(t);
  return palavras.length >= 3 && temAcao && (temAssunto || palavras.length >= 5);
}

function ehContinuidadeCurta(pergunta = '') {
  const t = normalizarTexto(pergunta);
  if (!t || ehPerguntaCompletaClara(pergunta)) return false;
  if (t.split(' ').length > 8) return false;
  return /\b(android|iphone|computador|facebook|instagram|whatsapp|youtube|como|confirmo|confirmar|posso|faço|faco|agora|isso|ele|ela|e ai|o que|qual|sim|nao|não|nao sei|não sei|depois|confiar|golpe)\b/.test(t);
}

function normalizarIntencaoContinuidade(texto = '') {
  let intencao = limparCampoResposta(texto).replace(/[?!.]+$/g, '').trim();
  intencao = intencao.replace(/^como\s+(eu\s+)?/i, '');
  intencao = intencao.replace(/^(?:eu\s+)?(?:quero|preciso)\s+/i, '');
  intencao = intencao.replace(/^aumento\b/i, 'aumentar').replace(/^apago\b/i, 'apagar').replace(/^mudo\b/i, 'mudar').replace(/^abro\b/i, 'abrir');
  intencao = intencao.replace(/\bwhatsapp\b/ig, 'WhatsApp').replace(/\byoutube\b/ig, 'YouTube').replace(/\bfacebook\b/ig, 'Facebook').replace(/\binstagram\b/ig, 'Instagram');
  return intencao.trim();
}

function ultimaMensagemPorRole(historico = [], role = 'user') {
  return [...historico].reverse().find((m) => m?.role === role && typeof m.content === 'string' && normalizarTexto(m.content));
}

function assistentePerguntouDispositivo(historico = []) {
  const ultima = ultimaMensagemPorRole(historico, 'assistant');
  if (!ultima) return false;
  const t = normalizarTexto(ultima.content);
  return /android/.test(t) && /iphone/.test(t) && /computador/.test(t);
}

function usuarioNaoSabeDispositivo(perguntaAtual = '', historicoSeguro = []) {
  if (!assistentePerguntouDispositivo(historicoSeguro)) return false;
  const t = normalizarTexto(perguntaAtual);
  return /^(?:eu\s+)?nao sei(?: qual e| o que e isso| o que e android)?$/.test(t)
    || /^(?:eu\s+)?nao entendi$/.test(t)
    || /^nao sei o que e android$/.test(t);
}

function respostaNaoSabeDispositivo(historicoSeguro = []) {
  const ultimoUsuario = ultimaMensagemPorRole(historicoSeguro, 'user');
  const intencao = ultimoUsuario && ehDuvidaDigital(normalizarTexto(ultimoUsuario.content)) ? normalizarIntencaoContinuidade(ultimoUsuario.content) : '';
  const passos = [
    'Android costuma ser celular Samsung, Motorola, Xiaomi e outros.',
    'iPhone é o celular da Apple.',
    'Se você não souber qual é o seu, procure o ícone do aplicativo na tela e toque nele.',
    'Também pode pedir ajuda a alguém de confiança para identificar o modelo.'
  ];
  if (intencao) passos.push(`Se a dúvida era ${intencao}, comece procurando o ícone do aplicativo na tela do celular.`);
  return pacote(TIPOS_PUBLICOS.duvida_digital, {
    respostaSimples: 'Sem problema. Android é o sistema de celulares como Samsung, Motorola, Xiaomi e outros. iPhone é o celular da Apple.',
    passoAPasso: passos,
    atencao: 'Nunca envie senha, código, CPF, cartão ou documento para outras pessoas.',
    opcoesFluxo: ['Procurar pelo ícone', 'Pedir ajuda para identificar o celular']
  }, 'fallback_local_orientado');
}

function detectarContinuidadeDeEscolha(perguntaAtual = '', historicoSeguro = []) {
  const escolha = normalizarTexto(perguntaAtual);
  const historico = Array.isArray(historicoSeguro) ? historicoSeguro : [];
  const ultimoUsuario = ultimaMensagemPorRole(historico, 'user');

  const dispositivo = escolha === 'android' ? 'Android' : escolha === 'iphone' ? 'iPhone' : /^(computador|pc|notebook)$/.test(escolha) ? 'computador' : '';
  if (dispositivo && ultimoUsuario && assistentePerguntouDispositivo(historico) && ehDuvidaDigital(normalizarTexto(ultimoUsuario.content))) {
    const pedidoApp = detectarPedidoAbrirAplicativoPendente(historico);
    if (pedidoApp) {
      const nome = NOMES_APLICATIVOS[pedidoApp.app] || NOMES_APLICATIVOS.generico;
      return { perguntaExpandida: `Como abrir o aplicativo ${nome}?`, ultimaIntencao: 'abrir aplicativo', aplicativo: nome };
    }
    const intencao = normalizarIntencaoContinuidade(ultimoUsuario.content);
    if (!intencao) return null;
    const preposicao = dispositivo === 'computador' ? 'no' : 'no';
    const perguntaExpandida = `Como ${intencao} ${preposicao} ${dispositivo}?`;
    return { perguntaExpandida, ultimaIntencao: intencao, dispositivo };
  }

  const appContinuidade = /^(?:e\s+o\s+|e\s+a\s+|e\s+|o\s+|a\s+)?(facebook|instagram|whatsapp|youtube|messenger)$/.exec(escolha);
  if (appContinuidade && ultimoUsuario) {
    const app = appContinuidade[1];
    const anterior = normalizarTexto(ultimoUsuario.content);
    const nomes = { whatsapp: 'WhatsApp', youtube: 'YouTube', facebook: 'Facebook', instagram: 'Instagram', messenger: 'Messenger' };
    const nome = nomes[app] || app[0].toUpperCase() + app.slice(1);
    if (/\babrir\b|\baplicativo\b|\bapp\b/.test(anterior)) {
      return { perguntaExpandida: `Como abrir o aplicativo ${nome}?`, ultimaIntencao: 'abrir aplicativo', aplicativo: nome };
    }
    if (/foto|perfil/.test(anterior)) {
      return { perguntaExpandida: `Como mudar foto de perfil no ${nome}?`, ultimaIntencao: 'mudar foto de perfil', aplicativo: nome };
    }
    if (/volume|som|aumentar|diminuir/.test(anterior)) {
      return { perguntaExpandida: `Como ajustar o volume no ${nome}?`, ultimaIntencao: 'ajustar volume', aplicativo: nome };
    }
    if (/apagar|desinstalar|remover/.test(anterior)) {
      return { perguntaExpandida: `Como apagar o aplicativo ${nome}?`, ultimaIntencao: 'apagar aplicativo', aplicativo: nome };
    }
    if (/atualizar/.test(anterior)) {
      return { perguntaExpandida: `Como atualizar o aplicativo ${nome}?`, ultimaIntencao: 'atualizar aplicativo', aplicativo: nome };
    }
  }
  return null;
}

function historicoTemRisco(historico = []) {
  return historico.slice(-4).some((m) => m && typeof m.content === 'string' && contemRiscoReal(m.content));
}

function classificarRotaPrincipal(perguntaAtual = '', historico = []) {
  const t = normalizarTexto(perguntaAtual);
  if (!t || t.length < 2 || /^[?.!\s]+$/.test(perguntaAtual)) return 'incompreensivel';
  if (contemDadoSensivelCompartilhado(perguntaAtual)) return 'dado_sensivel';
  if (contemRiscoReal(perguntaAtual)) return 'risco_real';
  if (ehContinuidadeCurta(perguntaAtual) && !ehPerguntaCompletaClara(perguntaAtual) && historicoTemRisco(historico)) return 'continuidade';
  if (ehPerguntaPixSeguro(t)) return 'duvida_digital';
  if (ehDuvidaDigital(t)) return 'duvida_digital';
  return 'duvida_geral';
}

function detectarIntencao(pergunta = '') {
  const rota = classificarRotaPrincipal(pergunta, []);
  if (rota === 'dado_sensivel') return INTENCOES.find((i) => i.id === 'dado_sensivel');
  if (rota === 'risco_real') return INTENCOES.find((i) => i.id === 'risco_real');
  if (ehPerguntaPixSeguro(normalizarTexto(pergunta))) return INTENCOES.find((i) => i.id === 'pix_seguro');
  if (rota === 'duvida_digital') return INTENCOES.find((i) => i.id === 'guia_tecnologia');
  return INTENCOES.find((i) => i.id === 'duvida_geral');
}

function detectarIntencaoComHistorico(perguntaOriginal = '', historico = []) {
  const rota = classificarRotaPrincipal(perguntaOriginal, historico);
  if (rota === 'continuidade') return INTENCOES.find((i) => i.id === 'risco_real');
  return detectarIntencao(perguntaOriginal);
}

function selecionarGuia(rota, perguntaAtual = '') {
  if (rota === 'dado_sensivel') return GUIAS_LOCAIS.dado_sensivel;
  if (rota === 'risco_real' || rota === 'continuidade') return GUIAS_LOCAIS.risco_real;
  if (ehPerguntaPixSeguro(normalizarTexto(perguntaAtual))) return GUIAS_LOCAIS.pix_seguro;
  if (rota === 'duvida_digital') return GUIAS_LOCAIS.tecnologia;
  return GUIAS_LOCAIS.geral;
}

function historicoSeguroLimitado(historico = [], rota = 'duvida_geral', perguntaAtual = '') {
  if (rota !== 'continuidade' && !ehContinuidadeCurta(perguntaAtual)) return [];
  return historico
    .slice(-4)
    .filter((m) => m && typeof m.content === 'string' && !temDadoPessoal(m.content))
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: limparCampoResposta(m.content).slice(0, 400) }));
}

function montarPacoteIA(perguntaAtual, rota, guiaLocal, historicoSeguro = []) {
  return {
    perguntaAtual: String(perguntaAtual).slice(0, 800),
    rotaPrincipal: rota,
    assuntoDetectado: guiaLocal.id,
    nivelRisco: guiaLocal.risco,
    guiaLocal: {
      id: guiaLocal.id,
      categoria: guiaLocal.categoria,
      risco: guiaLocal.risco,
      contexto: guiaLocal.contexto,
      passosSugeridos: guiaLocal.passosSugeridos,
      regrasSeguranca: guiaLocal.regrasSeguranca,
      nuncaFazer: guiaLocal.nuncaFazer,
      alertaHumanoPadrao: guiaLocal.alertaHumanoPadrao
    },
    contextoInstitucional: 'Você é Sérgio, assistente da Obra Social Santa Isabel no OSSI Ajuda Digital. Ajude pessoas idosas com linguagem simples. Não invente dados institucionais, nomes de autores, links, endereços, horários ou serviços não informados.',
    historicoSeguro,
    formatoObrigatorio: CAMPOS_RESPOSTA
  };
}

function extrairJson(texto = '') {
  const raw = String(texto || '').trim();
  try { return JSON.parse(raw); } catch (_) {}
  const inicio = raw.indexOf('{');
  const fim = raw.lastIndexOf('}');
  if (inicio >= 0 && fim > inicio) {
    try { return JSON.parse(raw.slice(inicio, fim + 1)); } catch (_) {}
  }
  return null;
}

function parseIA(raw = '', defaults = {}) {
  const json = extrairJson(raw);
  if (json && typeof json === 'object') return respostaPadrao(json, defaults);
  return respostaPadrao({ respostaSimples: raw }, defaults);
}

const parseIADinamica = parseIA;

function validarRespostaIA(resposta, pacoteIA) {
  const texto = normalizarTexto([
    resposta?.respostaSimples,
    ...(resposta?.passoAPasso || []),
    resposta?.atencao,
    resposta?.alertaHumano,
    resposta?.quandoPedirAjuda
  ].filter(Boolean).join(' '));
  if (!resposta?.respostaSimples || pareceRespostaTruncada(resposta.respostaSimples)) return { ok: false, motivo: 'resposta_invalida' };
  if (/\b(explique de forma simples|sem detalhes tecnicos|dados nao confirmados|use apenas o que esta informado no sistema|nao devo inventar|prompt|guia local|pacote de orientacao|durante testes)\b/.test(texto)) return { ok: false, motivo: 'linguagem_interna' };
  if (pacoteIA.rotaPrincipal === 'duvida_digital' && /posso ajudar com essa duvida digital diga se voce usa android iphone ou computador para eu orientar melhor/.test(texto)) return { ok: false, motivo: 'fallback_generico_ia' };
  const orientouPagamentoEmRisco = /\b(envie|manda|mande|faca|faça|confirme)\b.{0,40}\b(dinheiro|pix|transferencia|pagamento)\b/.test(texto);
  const alertaParaNaoPagar = /\b(nao|nunca|jamais)\b.{0,25}\b(envie|mande|faca|faça|confirme|pague)\b.{0,50}\b(dinheiro|pix|transferencia|pagamento)\b/.test(texto);
  if (orientouPagamentoEmRisco && !alertaParaNaoPagar && ['alto', 'critico'].includes(pacoteIA.nivelRisco)) return { ok: false, motivo: 'pagamento_em_risco' };
  const pediuDadoSensivel = /\b(me informe|me diga|envie|mande|digite aqui|compartilhe|passe)\b.{0,50}\b(senha|codigo|token|cpf|cartao|documento|rg|chave pix|dados bancarios|banco)\b/.test(texto);
  const alertaParaNaoEnviar = /\b(nao|nunca|jamais)\b.{0,30}\b(informe|diga|envie|mande|digite|compartilhe|passe)\b.{0,60}\b(senha|codigo|token|cpf|cartao|documento|rg|chave pix|dados bancarios|banco)\b/.test(texto);
  if (pediuDadoSensivel && !alertaParaNaoEnviar) return { ok: false, motivo: 'pediu_dado_sensivel' };
  const mandouAbrirLinkSuspeito = /\b(clique|abra|acesse)\b.{0,35}\b(link estranho|link suspeito|link recebido|numero desconhecido)\b/.test(texto);
  const alertaParaNaoAbrirLink = /\b(nao|nunca|jamais)\b.{0,20}\b(clique|abra|acesse)\b.{0,45}\b(link estranho|link suspeito|link recebido|numero desconhecido)\b/.test(texto);
  if (mandouAbrirLinkSuspeito && !alertaParaNaoAbrirLink) return { ok: false, motivo: 'link_suspeito' };
  if (['alto', 'critico'].includes(pacoteIA.nivelRisco) && !resposta.alertaHumano) return { ok: false, motivo: 'sem_alerta_humano' };
  return { ok: true };
}

async function chamarNvidiaComPrompt(system, user, parser, maxTokens = 700) {
  const payload = {
    model: MODELO_NVIDIA,
    temperature: 0.15,
    max_tokens: maxTokens,
    extra_body: { chat_template_kwargs: { enable_thinking: false } },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  };
  const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) throw new Error('nvidia_http');
  const data = await resp.json();
  return parser(data?.choices?.[0]?.message?.content || '');
}

async function responderComIAOrientada(perguntaAtual, pacoteIA) {
  if (!process.env.NVIDIA_API_KEY) throw new Error('ia_indisponivel');
  const system = [
    'Você é Sérgio, chatbot IA-first da Obra Social Santa Isabel para idosos.',
    'Responda a pergunta atual de forma específica em português brasileiro simples, com tom calmo.',
    'Use o guia local como direção e guardrail, mas não copie um bloco pronto quando a pergunta pedir algo específico ou for continuação.',
    'Use passo a passo quando for ação prática. Não invente dados institucionais.',
    'Para dúvidas digitais simples, responda de forma geral primeiro; só pergunte Android, iPhone ou computador quando for indispensável.',
    'Não use linguagem interna em respostas ao usuário; diga: "Nunca envie senha, código, CPF, cartão ou documento para outras pessoas."',
    'Sobre WhatsApp, não trate abertura como uso de senha ou login. Se aparecer confirmação por código, oriente a usar somente no próprio celular e nunca compartilhar o código.',
    'Se a pergunta for sobre ligação no WhatsApp, responda com orientação prática: atender só se conhecer, não passar senha/código/CPF/banco/documento, desligar se pedirem dinheiro e bloquear se insistir.',
    'Não peça senha, código, CPF completo, cartão, documento, foto de documento, chave Pix ou dados bancários.',
    'Não recomende Pix, transferência ou pagamento se houver dúvida, urgência, número desconhecido, familiar falso ou risco real.',
    'Mantenha alertaHumano quando o risco for real.',
    'Não indique busca web nesta tarefa.',
    'Retorne SOMENTE JSON válido no formato: {"respostaSimples":"...","passoAPasso":[],"atencao":"","quandoPedirAjuda":"","alertaHumano":"","opcoesFluxo":[]}.'
  ].join(' ');
  const fallback = respostaPadrao(selecionarGuia(pacoteIA.rotaPrincipal, perguntaAtual).fallbackLocal);
  const resposta = await chamarNvidiaComPrompt(system, JSON.stringify(pacoteIA), (raw) => parseIA(raw, fallback));
  if (['alto', 'critico'].includes(pacoteIA.nivelRisco) && !resposta.alertaHumano) resposta.alertaHumano = pacoteIA.guiaLocal.alertaHumanoPadrao || ALERTA_HUMANO;
  const validacao = validarRespostaIA(resposta, pacoteIA);
  if (!validacao.ok) throw new Error(validacao.motivo);
  return respostaPadrao(resposta, fallback);
}

function fallbackDigitalEspecifico(pergunta = '') {
  const pedidoApp = detectarPedidoAbrirAplicativo(pergunta);
  if (pedidoApp) return responderAbrirAplicativoUniversal(pedidoApp.app);
  const t = normalizarTexto(pergunta);
  if (/whatsapp/.test(t) && /ligando|ligacao|chamada|atender/.test(t)) {
    return {
      respostaSimples: 'Se estão te ligando no WhatsApp, veja se é alguém conhecido. Se for desconhecido ou pedir dinheiro, código, senha, CPF, banco ou documento, desligue e peça ajuda.',
      passoAPasso: ['Se conhecer a pessoa e esperava a ligação, pode atender.', 'Se for desconhecido, atenda com cuidado ou não atenda.', 'Não passe senha, código, CPF, dados de banco nem documento.', 'Se pedir dinheiro, desligue e confirme por outro caminho.', 'Se insistir ou incomodar, bloqueie o contato no WhatsApp.'],
      atencao: 'Golpistas podem ligar pelo WhatsApp fingindo ser conhecidos.'
    };
  }
  if (/whatsapp/.test(t) && /abrir|app|aplicativo|entrar/.test(t)) {
    return {
      respostaSimples: 'Normalmente, para abrir o WhatsApp, basta tocar no ícone verde do WhatsApp na tela do celular.',
      passoAPasso: ['Olhe na tela inicial do celular ou na lista de aplicativos.', 'Procure o ícone verde do WhatsApp.', 'Toque uma vez no ícone para abrir.', 'Se não encontrar, use a busca do celular e digite WhatsApp.', 'Se aparecer confirmação por código, use somente no seu próprio celular e nunca compartilhe esse código com outra pessoa.'],
      atencao: 'Nunca envie senha, código, CPF, cartão ou documento para outras pessoas.'
    };
  }
  if (/facebook/.test(t) && /abrir|app|aplicativo|entrar/.test(t)) {
    return {
      respostaSimples: 'Procure o ícone azul do Facebook com a letra F e toque nele. Se não encontrar, use a busca do celular e digite Facebook.',
      passoAPasso: ['Olhe na tela inicial do celular.', 'Procure o ícone azul com a letra F.', 'Toque uma vez para abrir.', 'Se não encontrar, deslize a tela e use a busca do celular.', 'Digite Facebook e toque no aplicativo oficial.'],
      atencao: 'Não informe senha ou código fora do aplicativo oficial.'
    };
  }
  if (/instagram/.test(t) && /abrir|app|aplicativo|entrar/.test(t)) {
    return {
      respostaSimples: 'Procure o ícone do Instagram no celular e toque nele. Se não encontrar, use a busca do celular.',
      passoAPasso: ['Olhe na tela inicial do celular.', 'Procure o ícone colorido do Instagram.', 'Toque uma vez para abrir.', 'Se não encontrar, use a busca do celular e digite Instagram.'],
      atencao: 'Use apenas o aplicativo oficial.'
    };
  }
  if (/volume|som/.test(t)) {
    return {
      respostaSimples: 'Use os botões laterais do celular. Aperte o botão de aumentar volume e veja a barra subir na tela.',
      passoAPasso: ['Segure o celular e procure os botões na lateral.', 'Aperte o botão de cima ou o botão de aumentar volume.', 'Veja a barra de volume subir na tela.', 'Se ainda não ouvir, confira se o celular está no silencioso.'],
      atencao: 'Evite volume muito alto perto do ouvido.'
    };
  }
  if (/facebook/.test(t) && /foto|perfil/.test(t)) {
    return {
      respostaSimples: 'Para mudar a foto de perfil no Facebook, abra seu perfil no aplicativo e escolha a opção de editar a foto.',
      passoAPasso: ['Abra o Facebook.', 'Toque na sua foto ou no seu nome para abrir o perfil.', 'Toque na foto de perfil.', 'Escolha Selecionar foto do perfil ou Editar foto.', 'Escolha uma foto e salve.'],
      atencao: 'Não passe senha ou código para outra pessoa trocar a foto por você.'
    };
  }
  if (/instagram/.test(t) && /foto|perfil/.test(t)) {
    return {
      respostaSimples: 'Para mudar a foto de perfil no Instagram, faça pelo seu perfil dentro do aplicativo oficial.',
      passoAPasso: ['Abra o Instagram.', 'Toque na sua foto ou no seu perfil.', 'Toque em Editar perfil.', 'Toque em Alterar foto do perfil.', 'Escolha uma foto da galeria ou tire uma nova.', 'Confira e salve.'],
      atencao: 'Não informe senha nem código se alguém oferecer fazer isso por você.'
    };
  }
  if (/whatsapp/.test(t) && /foto|perfil/.test(t)) {
    return {
      respostaSimples: 'Para mudar a foto de perfil no WhatsApp, entre nas configurações do próprio WhatsApp.',
      passoAPasso: ['Abra o WhatsApp.', 'Toque em Configurações ou nos três pontinhos.', 'Toque no seu nome ou na sua foto.', 'Toque no ícone da câmera.', 'Escolha Galeria ou Câmera.', 'Ajuste a foto e confirme.'],
      atencao: 'Use apenas o WhatsApp oficial.'
    };
  }
  if (/apagar|desinstalar|remover/.test(t) && /app|aplicativo/.test(t)) {
    return {
      respostaSimples: 'Você pode apagar um aplicativo pelo celular, mas confira antes se não é um app importante.',
      passoAPasso: ['Encontre o aplicativo na tela do celular.', 'Toque e segure o ícone por alguns segundos.', 'Procure Remover, Desinstalar ou Apagar app.', 'Confirme somente se tiver certeza.', 'Se for app de banco, Gov.br ou WhatsApp, peça ajuda antes.'],
      atencao: 'Apagar aplicativo pode remover acesso ou dados salvos.'
    };
  }
  if (/atualizar/.test(t) && /computador|notebook|windows/.test(t)) {
    return {
      respostaSimples: 'Para atualizar o computador, use a atualização oficial do sistema e faça sem pressa.',
      passoAPasso: ['Conecte o computador na tomada.', 'Abra Configurações.', 'Procure Windows Update ou Atualização de software.', 'Clique em Verificar atualizações.', 'Se aparecer atualização oficial, instale e aguarde.', 'Não desligue o computador durante a atualização.'],
      atencao: 'Não instale atualização por link recebido em mensagem.'
    };
  }
  if (/exercicio|exercicios|treinar|lista/.test(t) && /celular|whatsapp|digital/.test(t)) {
    return {
      respostaSimples: 'Aqui vai uma lista simples para treinar o uso do celular com segurança.',
      passoAPasso: ['Aumente e diminua o volume.', 'Conecte e desconecte do Wi‑Fi da casa.', 'Abra o WhatsApp e mande uma mensagem para alguém de confiança.', 'Tire um print da tela.', 'Treine mudar uma foto de perfil somente se quiser e souber voltar depois.', 'Veja se um link parece estranho sem clicar nele.'],
      atencao: 'Treine sem usar banco, Pix, senha, CPF ou cartão.'
    };
  }
  if (/pix/.test(t)) return RESPOSTAS.pix_seguro;
  return RESPOSTAS.duvida_digital;
}

function fallbackGeralEspecifico(pergunta = '') {
  const t = normalizarTexto(pergunta);
  if (/mark zuckerberg/.test(t)) return RESPOSTAS.mark;
  if (/\binternet\b/.test(t)) return RESPOSTAS.internet;
  if (/quem fez|quem criou|autor|autoria|esse sistema|este sistema/.test(t)) return RESPOSTAS.institucional;
  if (/bob esponja/.test(t)) return RESPOSTAS.bob;
  return RESPOSTAS.geral;
}

function fallbackLocalSeguro(perguntaAtual, rota, guiaLocal) {
  if (rota === 'incompreensivel') return pacote(TIPOS_PUBLICOS.fallback, RESPOSTAS.incompreensivel, 'bloqueio_local');
  if (rota === 'dado_sensivel') return pacote(TIPOS_PUBLICOS.seguranca, RESPOSTAS.dados_sensiveis, 'bloqueio_local');
  if ((rota === 'risco_real' || rota === 'continuidade') && /\b(confirm|confirmo|sobrinho|filho|familiar|parente)\b/.test(normalizarTexto(perguntaAtual))) {
    return pacote(TIPOS_PUBLICOS.seguranca, {
      respostaSimples: 'Para confirmar se é mesmo seu familiar, não use só a foto ou o número novo. Confirme por um caminho que você já conhece.',
      passoAPasso: ['Ligue para o número antigo do seu sobrinho ou familiar.', 'Se não atender, fale com outro parente de confiança.', 'Faça uma pergunta pessoal que só ele saberia responder.', 'Se possível, peça chamada de vídeo.', 'Não envie dinheiro enquanto houver dúvida.'],
      atencao: 'Foto, nome e voz podem ser copiados ou usados por golpistas.',
      alertaHumano: ALERTA_HUMANO,
      quandoPedirAjuda: 'Peça ajuda na Obra Social Santa Isabel ou com um familiar de confiança antes de pagar.'
    }, 'fallback_local_seguro');
  }
  if (rota === 'risco_real' || rota === 'continuidade') return pacote(TIPOS_PUBLICOS.seguranca, guiaLocal.fallbackLocal || RESPOSTAS.risco_real, 'fallback_local_seguro');
  if (guiaLocal.id === 'pix_seguro') return pacote(TIPOS_PUBLICOS.seguranca, RESPOSTAS.pix_seguro, 'fallback_local_orientado');
  if (rota === 'duvida_digital') return pacote(TIPOS_PUBLICOS.duvida_digital, fallbackDigitalEspecifico(perguntaAtual), 'fallback_local_orientado');
  return pacote(TIPOS_PUBLICOS.duvida_geral, fallbackGeralEspecifico(perguntaAtual), 'fallback_local_orientado');
}

function ehPedidoRepeticao(pergunta = '') {
  const t = normalizarTexto(pergunta);
  return /\b(repita|repetir|de novo|saiu quebrada|saiu cortada|nao entendi sua resposta|não entendi sua resposta)\b/.test(t);
}

function respostaRepeticao(historico = []) {
  const ultima = [...historico].reverse().find((m) => m?.role === 'assistant' && typeof m.content === 'string' && m.content.trim());
  if (!ultima) {
    return pacote(TIPOS_PUBLICOS.fallback, { respostaSimples: 'Preciso que você me diga qual era a dúvida para eu repetir com calma.' }, 'fallback_local');
  }
  return pacote(TIPOS_PUBLICOS.fallback, { respostaSimples: `Desculpe, vou repetir com calma: ${limparCampoResposta(ultima.content).slice(0, 500)}` }, 'fallback_local');
}


function mascararDadosSensiveis(texto = '') {
  return String(texto)
    .replace(/\b\d{3}[.-]?\d{3}[.-]?\d{3}-?\d{2}\b/g, '[CPF]')
    .replace(/\b\d{13,16}\b/g, '[CARTAO]')
    .replace(/\b(senha|codigo|código|token|cpf|cartao|cartão|documento|rg|chave pix)\b\s*(?:e|é|eh|:|=)?\s*\S+/gi, '$1 [MASCARADO]')
    .replace(/\b\d{4,}\b/g, '[NUMERO]')
    .slice(0, 220);
}

function criarDebugSeguro(base = {}) {
  return {
    perguntaNormalizada: mascararDadosSensiveis(normalizarTexto(base.perguntaNormalizada || '')),
    perguntaEfetiva: mascararDadosSensiveis(String(base.perguntaEfetiva || base.perguntaNormalizada || '')),
    rotaPrincipal: base.rotaPrincipal || '',
    guiaEscolhido: base.guiaEscolhido || '',
    riscoDetectado: Boolean(base.riscoDetectado),
    usouHistorico: Boolean(base.usouHistorico),
    motivoUsoHistorico: base.motivoUsoHistorico || '',
    chamouIA: Boolean(base.chamouIA),
    iaOk: Boolean(base.iaOk),
    validacaoRejeitou: Boolean(base.validacaoRejeitou),
    motivoValidacao: base.motivoValidacao || '',
    origemFinal: base.origemFinal || '',
    fallbackUsado: Boolean(base.fallbackUsado),
    motivoFallback: base.motivoFallback || ''
  };
}

function anexarDebugSeguro(payload, debug) {
  const resumo = criarDebugSeguro({ ...debug, origemFinal: payload?.origem || debug.origemFinal });
  if (process.env.SERGIO_DEBUG === 'true') {
    console.info(`[sergio-debug] rota=${resumo.rotaPrincipal} guia=${resumo.guiaEscolhido} chamouIA=${resumo.chamouIA} fallback=${resumo.fallbackUsado}`);
  }
  return payload;
}

async function gerarRespostaDinamicaSegura(perguntaAtual, intencao, historicoSeguro = []) {
  const guia = GUIAS_LOCAIS[intencao?.guia] || GUIAS_LOCAIS.risco_real;
  const pacoteIA = montarPacoteIA(perguntaAtual, intencao?.id === 'risco_real' ? 'risco_real' : 'duvida_digital', guia, historicoSeguro);
  const resposta = await responderComIAOrientada(perguntaAtual, pacoteIA);
  return pacote(guia.categoria, resposta, 'ia_orientada');
}

export default async function handler(req, res) {
  res.setHeader?.('Cache-Control', 'no-store, max-age=0');
  res.setHeader?.('Pragma', 'no-cache');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const perguntaOriginal = String(req.body?.pergunta || '');
  const historico = Array.isArray(req.body?.historico) ? req.body.historico : [];
  if (!normalizarTexto(perguntaOriginal)) return res.status(400).json({ error: 'Pergunta inválida.' });

  const naoSabeDispositivo = usuarioNaoSabeDispositivo(perguntaOriginal, historico);
  const continuidadeEscolha = naoSabeDispositivo ? null : detectarContinuidadeDeEscolha(perguntaOriginal, historico);
  const perguntaEfetiva = continuidadeEscolha?.perguntaExpandida || perguntaOriginal;
  const rota = naoSabeDispositivo ? 'duvida_digital' : classificarRotaPrincipal(perguntaEfetiva, historico);
  const guiaLocal = selecionarGuia(rota, perguntaEfetiva);
  const debug = {
    perguntaNormalizada: perguntaOriginal,
    perguntaEfetiva,
    rotaPrincipal: rota,
    guiaEscolhido: guiaLocal.id,
    riscoDetectado: rota === 'risco_real' || rota === 'continuidade' || rota === 'dado_sensivel',
    usouHistorico: Boolean(continuidadeEscolha) || (rota === 'continuidade' && ehContinuidadeCurta(perguntaEfetiva)),
    motivoUsoHistorico: continuidadeEscolha ? 'continuidade_de_escolha' : rota === 'continuidade' ? 'pergunta_curta_dependente_com_risco_no_historico' : '',
    chamouIA: false,
    iaOk: false,
    validacaoRejeitou: false,
    motivoValidacao: '',
    origemFinal: '',
    fallbackUsado: false,
    motivoFallback: ''
  };

  const pedidoAbrirApp = detectarPedidoAbrirAplicativo(perguntaEfetiva)
    || (ehRespostaCurtaDeDispositivoOuDuvida(perguntaOriginal) ? detectarPedidoAbrirAplicativoPendente(historico) : null);
  if (pedidoAbrirApp) {
    const payload = pacote(TIPOS_PUBLICOS.duvida_digital, responderAbrirAplicativoUniversal(pedidoAbrirApp.app), 'rota_direta_abrir_app');
    return res.status(200).json(anexarDebugSeguro(payload, { ...debug, guiaEscolhido: 'abrir_aplicativo_universal', origemFinal: payload.origem }));
  }

  if (ehPedidoRepeticao(perguntaOriginal)) {
    const payload = respostaRepeticao(historico);
    return res.status(200).json(anexarDebugSeguro(payload, { ...debug, origemFinal: payload.origem, fallbackUsado: true, motivoFallback: 'pedido_repeticao' }));
  }

  if (naoSabeDispositivo) {
    const payload = respostaNaoSabeDispositivo(historico);
    return res.status(200).json(anexarDebugSeguro(payload, { ...debug, origemFinal: payload.origem, fallbackUsado: true, motivoFallback: 'usuario_nao_sabe_dispositivo' }));
  }

  if (rota === 'incompreensivel' || rota === 'dado_sensivel') {
    const payload = fallbackLocalSeguro(perguntaEfetiva, rota, guiaLocal);
    return res.status(200).json(anexarDebugSeguro(payload, { ...debug, origemFinal: payload.origem, fallbackUsado: true, motivoFallback: rota }));
  }

  const historicoSeguro = historicoSeguroLimitado(historico, rota, perguntaEfetiva);
  debug.usouHistorico = debug.usouHistorico || historicoSeguro.length > 0;
  if (!debug.motivoUsoHistorico && historicoSeguro.length > 0) debug.motivoUsoHistorico = 'pergunta_curta_dependente';
  const pacoteIA = montarPacoteIA(perguntaEfetiva, rota, guiaLocal, historicoSeguro);

  try {
    debug.chamouIA = Boolean(process.env.NVIDIA_API_KEY);
    const resposta = await responderComIAOrientada(perguntaEfetiva, pacoteIA);
    debug.iaOk = true;
    const payload = pacote(guiaLocal.categoria, resposta, 'ia_orientada');
    return res.status(200).json(anexarDebugSeguro(payload, debug));
  } catch (erro) {
    const motivo = erro?.message || 'ia_falhou';
    debug.validacaoRejeitou = ['resposta_invalida', 'pagamento_em_risco', 'pediu_dado_sensivel', 'link_suspeito', 'sem_alerta_humano', 'fallback_generico_ia'].includes(motivo);
    debug.motivoValidacao = debug.validacaoRejeitou ? motivo : '';
    debug.fallbackUsado = true;
    debug.motivoFallback = motivo;
    const payload = fallbackLocalSeguro(perguntaEfetiva, rota, guiaLocal);
    return res.status(200).json(anexarDebugSeguro(payload, debug));
  }
}
export {
  INTENCOES,
  PACOTES_ORIENTACAO,
  GUIAS_LOCAIS,
  TIPOS_PUBLICOS,
  detectarIntencao,
  detectarIntencaoComHistorico,
  normalizarTexto,
  contemTermoRisco,
  ehContinuidadeCurta,
  ehPerguntaCompletaClara,
  detectarContinuidadeDeEscolha,
  pareceRespostaTruncada,
  gerarRespostaDinamicaSegura,
  montarPacoteIA,
  responderComIAOrientada,
  validarRespostaIA,
  classificarRotaPrincipal,
  contemRiscoReal,
  detectarPedidoAbrirAplicativo,
  responderAbrirAplicativoUniversal
};
