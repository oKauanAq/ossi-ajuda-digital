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
    [/\b(?:whastapp|whatsap+|whatss?ap+|watsap+|zap)\b/g, 'whatsapp'],
    [/\bface\b/g, 'facebook'],
    [/\bgov\s*br\b/g, 'gov.br'],
    [/\bminhas senha\b/g, 'minha senha'],
    [/\besqueci minhas senha\b/g, 'esqueci minha senha'],
    [/\b(?:pics|piks|pique)\b/g, 'pix'],
    [/\blink\s+(?:extra|estra|estranha|suspeita)\b/g, 'link estranho'],
    [/\bseguranca\b/g, 'seguranca'],
    [/\bcodigo\b/g, 'codigo']
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
  const passos = Array.isArray(resposta.passoAPasso)
    ? resposta.passoAPasso.map((p) => limparCampoResposta(p)).filter(Boolean).filter((p) => {
      const chave = normalizarTexto(p);
      if (passosVistos.has(chave)) return false;
      passosVistos.add(chave);
      return true;
    }).slice(0, 6)
    : [];

  return {
    respostaSimples: garantirRespostaCompleta(resposta.respostaSimples || defaults.respostaSimples || 'Não consegui entender bem. Pode perguntar de outro jeito?', defaults.respostaSimples || RESPOSTA_TRUNCADA_FALLBACK),
    passoAPasso: passos,
    atencao: limparCampoResposta(resposta.atencao || defaults.atencao || ''),
    alertaHumano: limparCampoResposta(resposta.alertaHumano || defaults.alertaHumano || ''),
    quandoPedirAjuda: limparCampoResposta(resposta.quandoPedirAjuda || defaults.quandoPedirAjuda || ''),
    opcoesFluxo: Array.isArray(resposta.opcoesFluxo) ? resposta.opcoesFluxo.map((o) => limparCampoResposta(o)).filter(Boolean).slice(0, 8) : []
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
    atencao: 'Não envie senha, código, CPF, cartão ou documento durante testes.',
    opcoesFluxo: ['Android', 'iPhone', 'Computador', 'WhatsApp', 'Instagram']
  },
  geral: {
    respostaSimples: 'Posso responder de forma simples, mas não devo inventar informações. Se for sobre a Obra Social Santa Isabel, use apenas o que está informado no sistema ou pergunte a alguém da instituição.',
    passoAPasso: [],
    atencao: 'Se aparecer pedido de dinheiro, senha, código ou link estranho, trate como risco.'
  },
  institucional: {
    respostaSimples: 'Este sistema é o OSSI Ajuda Digital, criado para apoiar pessoas idosas com dúvidas digitais na Obra Social Santa Isabel.',
    passoAPasso: ['Ele reúne uma central de ajuda e o assistente Sérgio.', 'O objetivo é orientar com linguagem simples e cuidado com golpes.', 'Eu não devo inventar nomes de autores, equipes ou dados institucionais que não estejam no sistema.'],
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
  return /\b(whatsapp|instagram|facebook|celular|telefone|android|iphone|computador|notebook|app|aplicativo|foto|perfil|volume|som|wi-fi|wifi|print|tela|atualizar|apagar|instalar|desinstalar|mensagem|audio|video|exercicios|treinar)\b/.test(t);
}

function ehContinuidadeCurta(pergunta = '') {
  const t = normalizarTexto(pergunta);
  if (!t) return false;
  if (t.split(' ').length > 8) return false;
  return /\b(como|confirmo|confirmar|posso|faço|faco|agora|isso|ele|ela|e ai|o que|qual|sim|nao|não)\b/.test(t);
}

function historicoTemRisco(historico = []) {
  return historico.slice(-4).some((m) => m && typeof m.content === 'string' && contemRiscoReal(m.content));
}

function classificarRotaPrincipal(perguntaAtual = '', historico = []) {
  const t = normalizarTexto(perguntaAtual);
  if (!t || t.length < 2 || /^[?.!\s]+$/.test(perguntaAtual)) return 'incompreensivel';
  if (contemDadoSensivelCompartilhado(perguntaAtual)) return 'dado_sensivel';
  if (ehContinuidadeCurta(perguntaAtual) && historicoTemRisco(historico)) return 'continuidade';
  if (contemRiscoReal(perguntaAtual)) return 'risco_real';
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
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: limparCampoResposta(m.content).slice(0, 180) }));
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
  if (/\b(envie|manda|mande|faca|faça|confirme)\b.{0,40}\b(dinheiro|pix|transferencia|pagamento)\b/.test(texto) && ['alto', 'critico'].includes(pacoteIA.nivelRisco)) return { ok: false, motivo: 'pagamento_em_risco' };
  if (/\b(me informe|me diga|envie|mande|digite aqui|compartilhe)\b.{0,50}\b(senha|codigo|token|cpf|cartao|documento|rg|chave pix|dados bancarios)\b/.test(texto)) return { ok: false, motivo: 'pediu_dado_sensivel' };
  if (/\b(clique|abra|acesse)\b.{0,35}\b(link estranho|link suspeito|link recebido|numero desconhecido)\b/.test(texto)) return { ok: false, motivo: 'link_suspeito' };
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
  const t = normalizarTexto(pergunta);
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
      passoAPasso: ['Aumente e diminua o volume.', 'Conecte e desconecte do Wi‑Fi da casa.', 'Abra o WhatsApp e mande uma mensagem para alguém de confiança.', 'Tire um print da tela.', 'Mude uma foto de perfil de teste, se quiser.', 'Veja se um link parece estranho sem clicar nele.'],
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
  const rota = classificarRotaPrincipal(perguntaOriginal, historico);
  if (!normalizarTexto(perguntaOriginal)) return res.status(400).json({ error: 'Pergunta inválida.' });

  if (ehPedidoRepeticao(perguntaOriginal)) return res.status(200).json(respostaRepeticao(historico));

  const guiaLocal = selecionarGuia(rota, perguntaOriginal);

  if (rota === 'incompreensivel' || rota === 'dado_sensivel') {
    return res.status(200).json(fallbackLocalSeguro(perguntaOriginal, rota, guiaLocal));
  }

  const historicoSeguro = historicoSeguroLimitado(historico, rota, perguntaOriginal);
  const pacoteIA = montarPacoteIA(perguntaOriginal, rota, guiaLocal, historicoSeguro);

  try {
    const resposta = await responderComIAOrientada(perguntaOriginal, pacoteIA);
    return res.status(200).json(pacote(guiaLocal.categoria, resposta, 'ia_orientada'));
  } catch {
    return res.status(200).json(fallbackLocalSeguro(perguntaOriginal, rota, guiaLocal));
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
  pareceRespostaTruncada,
  gerarRespostaDinamicaSegura,
  montarPacoteIA,
  responderComIAOrientada,
  validarRespostaIA,
  classificarRotaPrincipal,
  contemRiscoReal
};
