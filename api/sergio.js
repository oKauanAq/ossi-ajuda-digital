import fs from 'fs';
import path from 'path';

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

const APLICATIVOS = ['whatsapp', 'facebook', 'instagram', 'gov.br', 'banco', 'email', 'e-mail'];
const TERMOS_RISCO = [
  'senha', 'codigo', 'token', 'pix', 'banco', 'dinheiro', 'pagamento', 'pagar', 'transferencia',
  'deposito', 'boleto', 'link suspeito', 'link estranho', 'cpf', 'cartao', 'documento', 'rg',
  'loja', 'site', 'golpe', 'numero desconhecido', 'numero novo', 'familiar pedindo dinheiro',
  'pedindo dinheiro', 'pedindo pix', 'pediu dinheiro', 'pediu pix'
];

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

  substituicoes.forEach(([padrao, valor]) => {
    texto = texto.replace(padrao, valor);
  });

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
  return String(valor)
    .replace(/```json|```/gi, ' ')
    .replace(/[{}[\]"]/g, ' ')
    .replace(/\\[nrt]/g, ' ')
    .replace(/\\/g, ' ')
    .replace(/\b(resposta\s*simples|respostasimples|passo\s*a\s*passo|passoapasso|atencao|aten[cç][aã]o|quando\s*pedir\s*ajuda|quandopedirajuda)\s*[:=-]?/gi, ' ')
    .replace(/^\s*\d+[.)-]\s*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/,\s*$/, '.')
    .trim()
    .slice(0, 420);
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

  const base = {
    respostaSimples: limparCampoResposta(resposta.respostaSimples || defaults.respostaSimples || 'Não consegui entender bem. Pode perguntar de outro jeito?'),
    passoAPasso: passos,
    atencao: limparCampoResposta(resposta.atencao || defaults.atencao || ''),
    quandoPedirAjuda: limparCampoResposta(resposta.quandoPedirAjuda || defaults.quandoPedirAjuda || ''),
    opcoesFluxo: Array.isArray(resposta.opcoesFluxo) ? resposta.opcoesFluxo.map((o) => limparCampoResposta(o)).filter(Boolean).slice(0, 8) : []
  };

  const primeiroPasso = normalizarTexto(base.passoAPasso[0] || '');
  const respostaNorm = normalizarTexto(base.respostaSimples);
  if (primeiroPasso && respostaNorm && (primeiroPasso.includes(respostaNorm) || respostaNorm.includes(primeiroPasso))) {
    base.passoAPasso = base.passoAPasso.slice(1);
  }

  const atencaoNorm = normalizarTexto(base.atencao);
  const ajudaNorm = normalizarTexto(base.quandoPedirAjuda);
  if (atencaoNorm && ajudaNorm && (atencaoNorm.includes(ajudaNorm) || ajudaNorm.includes(atencaoNorm))) {
    base.quandoPedirAjuda = '';
  }

  return base;
}

const pacote = (tipo, resposta, origem) => ({ tipo, resposta, origem });

const RESPOSTAS = {
  incompreensivel: {
    respostaSimples: 'Não entendi bem. Pode repetir com calma?',
    passoAPasso: ['Fale uma frase curta.', 'Diga o nome do aplicativo, como WhatsApp, Facebook ou banco.', 'Se preferir, escreva sua dúvida.'],
    atencao: 'Não fale senha, código, CPF ou dados do banco.',
    quandoPedirAjuda: 'Peça ajuda se for sobre dinheiro, senha ou golpe.'
  },
  senha_generica: {
    respostaSimples: 'Posso ajudar. Primeiro preciso saber de qual aplicativo ou conta estamos falando.',
    passoAPasso: ['Escolha uma opção abaixo ou escreva o nome do aplicativo.', 'Não envie sua senha para ninguém.', 'Não envie código recebido por SMS ou WhatsApp.'],
    atencao: 'Nunca compartilhe senha, código, CPF, cartão ou documento.',
    quandoPedirAjuda: 'Peça ajuda se aparecer cobrança, link estranho ou pedido de código.',
    opcoesFluxo: ['Facebook', 'Instagram', 'Gov.br', 'Banco', 'E-mail', 'WhatsApp', 'Outro aplicativo']
  },
  senha_whatsapp: {
    respostaSimples: 'Entendi. Vamos cuidar do acesso ao WhatsApp com segurança.',
    passoAPasso: ['Abra o WhatsApp pelo aplicativo oficial.', 'Siga a recuperação indicada na tela.', 'Se aparecer código por SMS, não envie esse código para ninguém.', 'Se perdeu o número antigo, peça ajuda antes de tentar recuperar.', 'Não clique em links prometendo recuperar conta.'],
    atencao: 'Golpistas podem pedir código do WhatsApp para roubar sua conta.',
    quandoPedirAjuda: 'Peça ajuda se alguém pedir código, dinheiro ou mandar link estranho.'
  },
  senha_facebook: {
    respostaSimples: 'Para recuperar o Facebook, use apenas o aplicativo ou site oficial.',
    passoAPasso: ['Abra o aplicativo oficial do Facebook ou digite facebook.com no navegador.', 'Toque em Esqueci a senha.', 'Digite seu e-mail ou telefone.', 'Siga o código enviado para você.', 'Crie uma senha nova e forte.', 'Não passe o código para ninguém.'],
    atencao: 'Não clique em links de recuperação enviados por desconhecidos.',
    quandoPedirAjuda: 'Peça ajuda se aparecer cobrança, ameaça ou pedido de código.'
  },
  senha_instagram: {
    respostaSimples: 'Para recuperar o Instagram, use apenas o aplicativo oficial.',
    passoAPasso: ['Abra o Instagram oficial.', 'Toque em Esqueceu a senha ou Obter ajuda para entrar.', 'Informe seu telefone, e-mail ou usuário.', 'Siga as instruções recebidas.', 'Crie uma senha nova.', 'Não compartilhe código com ninguém.'],
    atencao: 'Golpistas podem fingir suporte do Instagram.',
    quandoPedirAjuda: 'Peça ajuda se pedirem pagamento ou código fora do aplicativo.'
  },
  senha_gov: {
    respostaSimples: 'Para recuperar a senha do Gov.br, use somente o aplicativo ou site oficial gov.br.',
    passoAPasso: ['Abra o aplicativo Gov.br ou o site gov.br.', 'Toque em Entrar com gov.br.', 'Escolha Esqueci minha senha.', 'Siga a confirmação indicada na tela.', 'Crie uma senha nova.', 'Não envie foto de documento para pessoa desconhecida.'],
    atencao: 'Gov.br dá acesso a serviços importantes. Tenha calma e use só canais oficiais.',
    quandoPedirAjuda: 'Peça ajuda se alguém oferecer recuperação por link ou cobrar dinheiro.'
  },
  senha_banco: {
    respostaSimples: 'Para senha de banco, faça tudo pelo aplicativo oficial ou pela agência.',
    passoAPasso: ['Abra apenas o aplicativo oficial do seu banco.', 'Procure a opção Esqueci minha senha ou Ajuda.', 'Não informe senha, código ou token por telefone ou mensagem.', 'Se tiver dúvida, ligue para o número no verso do cartão.', 'Se possível, vá até uma agência ou peça ajuda a alguém de confiança.'],
    atencao: 'Banco nunca precisa que você envie senha completa por WhatsApp.',
    quandoPedirAjuda: 'Peça ajuda antes de instalar aplicativo, fazer Pix ou confirmar código.'
  },
  senha_email: {
    respostaSimples: 'Para recuperar e-mail, use a tela oficial do seu provedor.',
    passoAPasso: ['Abra o aplicativo ou site oficial do e-mail.', 'Toque em Esqueci a senha.', 'Confirme pelo telefone ou e-mail de recuperação.', 'Crie uma senha nova.', 'Ative verificação em duas etapas se aparecer essa opção.'],
    atencao: 'Quem entra no seu e-mail pode tentar acessar outras contas.',
    quandoPedirAjuda: 'Peça ajuda se houver mensagem de invasão ou pedido de código.'
  },
  pix_como_fazer: {
    respostaSimples: 'Você pode fazer Pix com segurança pelo aplicativo oficial do banco.',
    passoAPasso: ['Abra o aplicativo oficial do banco.', 'Toque em Pix.', 'Escolha pagar, transferir ou ler QR Code.', 'Confira nome, valor e banco da pessoa antes de confirmar.', 'Digite sua senha apenas dentro do aplicativo oficial.', 'Guarde o comprovante.'],
    atencao: 'Se o nome ou valor estiver diferente, pare e não confirme.',
    quandoPedirAjuda: 'Peça ajuda antes de fazer Pix alto ou urgente.'
  },
  pix_urgente_golpe: {
    respostaSimples: 'Não envie dinheiro agora. Pedido de Pix urgente pode ser golpe.',
    passoAPasso: ['Pare antes de pagar.', 'Ligue para a pessoa por um número que você já conhece.', 'Confirme a história com calma.', 'Não use o número novo como única confirmação.', 'Peça ajuda a alguém de confiança.'],
    atencao: 'Golpistas usam pressa para fazer você pagar sem pensar.',
    quandoPedirAjuda: 'Peça ajuda sempre que pedirem dinheiro por mensagem.'
  },
  golpe_familiar_falso: {
    respostaSimples: 'Pode ser golpe. Não envie dinheiro e não responda com pressa.',
    passoAPasso: ['Não faça Pix nem transferência.', 'Não clique em links.', 'Ligue para seu familiar pelo número antigo que você já conhece.', 'Pergunte algo que só ele saberia responder.', 'Se confirmar suspeita, bloqueie e denuncie o contato.', 'Peça ajuda a alguém de confiança.'],
    atencao: 'Golpistas podem usar foto e nome de familiar para enganar.',
    quandoPedirAjuda: 'Peça ajuda antes de enviar qualquer valor, principalmente se for urgente ou alto.'
  },
  link_suspeito: {
    respostaSimples: 'Link estranho pode ser golpe. Não clique e não preencha dados.',
    passoAPasso: ['Não abra o link se ainda não abriu.', 'Se abriu, não digite senha, CPF, cartão ou código.', 'Feche a página.', 'Abra o aplicativo oficial da empresa para conferir.', 'Apague a mensagem se parecer golpe.'],
    atencao: 'Promoção, prêmio e urgência costumam ser usados em golpes.',
    quandoPedirAjuda: 'Peça ajuda se você clicou, pagou ou informou dados.'
  },
  loja_confiavel: {
    respostaSimples: 'Posso ajudar a verificar. Qual é o nome ou site da loja?',
    passoAPasso: ['Confira se o endereço do site está correto.', 'Procure CNPJ, telefone e endereço real.', 'Desconfie de preço muito abaixo do normal.', 'Pesquise reclamações da loja.', 'Evite pagar por Pix para pessoa física desconhecida.'],
    atencao: 'Loja falsa costuma usar preço muito barato e pressão para pagar rápido.',
    quandoPedirAjuda: 'Peça ajuda antes de comprar se tiver dúvida.'
  },
  banco_generico: {
    respostaSimples: 'Entendi. É problema para entrar no app, fazer Pix, ver saldo ou outro assunto?',
    passoAPasso: ['Escolha uma opção abaixo para eu explicar melhor.'],
    atencao: 'Nunca compartilhe senha ou código do banco.',
    quandoPedirAjuda: 'Peça ajuda antes de confirmar pagamento.',
    opcoesFluxo: ['Pix', 'Entrar no app', 'Ver saldo', 'Outro assunto']
  },
  whatsapp_generico: {
    respostaSimples: 'Você quer mandar mensagem, colocar foto, recuperar conta ou verificar golpe?',
    passoAPasso: ['Escolha uma opção abaixo para continuar.'],
    atencao: 'Não passe código de verificação do WhatsApp.',
    quandoPedirAjuda: '',
    opcoesFluxo: ['Mandar mensagem', 'Colocar foto', 'Recuperar conta', 'Verificar golpe']
  },
  whatsapp_mensagem: {
    respostaSimples: 'Mandar mensagem no WhatsApp é simples.',
    passoAPasso: ['Abra o WhatsApp.', 'Toque na conversa da pessoa.', 'Digite sua mensagem.', 'Toque na seta para enviar.', 'Confira se enviou para a pessoa certa.'],
    atencao: 'Confira o nome antes de enviar informação importante.',
    quandoPedirAjuda: ''
  },
  whatsapp_foto: {
    respostaSimples: 'Você pode trocar a foto do WhatsApp em poucos toques.',
    passoAPasso: ['Abra o WhatsApp.', 'Toque em Configurações.', 'Toque no seu nome ou na sua foto.', 'Toque no ícone de câmera.', 'Escolha uma foto da galeria.', 'Confirme a troca.'],
    atencao: 'Evite usar foto com documento ou dados pessoais.',
    quandoPedirAjuda: ''
  },
  whatsapp_contato: {
    respostaSimples: 'Você pode salvar um contato pelo aplicativo Contatos do celular.',
    passoAPasso: ['Abra Contatos no celular.', 'Toque em adicionar novo contato.', 'Digite nome e telefone.', 'Salve.', 'Abra o WhatsApp e procure o nome da pessoa.'],
    atencao: 'Confirme o número antes de enviar mensagem.',
    quandoPedirAjuda: ''
  },
  whatsapp_audio: {
    respostaSimples: 'Para mandar áudio no WhatsApp, use o botão do microfone na conversa.',
    passoAPasso: ['Abra a conversa no WhatsApp.', 'Segure o botão do microfone.', 'Fale perto do celular.', 'Solte para enviar.', 'Se errar, apague e grave de novo.'],
    atencao: 'Não envie dados de banco, senha ou código por áudio.',
    quandoPedirAjuda: ''
  },
  celular_volume: {
    respostaSimples: 'Vamos aumentar o volume com calma.',
    passoAPasso: ['Pegue o celular na mão.', 'Aperte o botão de cima na lateral.', 'Veja se a barra de volume aparece na tela.', 'Teste o som com um vídeo curto.', 'Se ainda estiver baixo, abra Configurações e toque em Som.'],
    atencao: 'Não instale aplicativo desconhecido para aumentar som.',
    quandoPedirAjuda: 'Peça ajuda se o botão não funcionar.'
  },
  celular_wifi: {
    respostaSimples: 'Você pode conectar no Wi-Fi pelas configurações.',
    passoAPasso: ['Abra Configurações.', 'Toque em Wi-Fi.', 'Escolha a rede da sua casa.', 'Digite a senha e confirme.', 'Espere aparecer Conectado.'],
    atencao: 'Evite rede aberta desconhecida.',
    quandoPedirAjuda: ''
  },
  celular_print: {
    respostaSimples: 'Para tirar print, use os botões do celular.',
    passoAPasso: ['Abra a tela que deseja salvar.', 'Aperte juntos o botão de ligar e volume para baixo.', 'Procure a imagem na galeria.', 'Compartilhe só com pessoa de confiança.'],
    atencao: '',
    quandoPedirAjuda: ''
  },
  celular_sem_som: {
    respostaSimples: 'Vamos verificar por que o celular está sem som.',
    passoAPasso: ['Aumente o volume pelo botão lateral.', 'Veja se o modo silencioso está ligado.', 'Desative o Bluetooth se o som estiver indo para outro aparelho.', 'Teste com uma música ou vídeo.', 'Reinicie o celular se continuar sem som.'],
    atencao: 'Não instale aplicativo desconhecido prometendo consertar som.',
    quandoPedirAjuda: 'Peça ajuda se caiu água ou o alto-falante parece quebrado.'
  },
  instalar_pwa: {
    respostaSimples: 'Você pode adicionar o OSSI Ajuda Digital na tela inicial.',
    passoAPasso: ['Abra o site no navegador do celular.', 'No Android, toque nos três pontos do navegador.', 'Toque em Adicionar à tela inicial.', 'No iPhone, toque em Compartilhar.', 'Toque em Adicionar à Tela de Início.'],
    atencao: '',
    quandoPedirAjuda: ''
  },
  bob_esponja: {
    respostaSimples: 'Bob Esponja é um personagem de desenho animado. Ele é uma esponja amarela que vive no fundo do mar, em uma casa de abacaxi, e trabalha no Siri Cascudo. É uma série de humor feita principalmente para crianças, mas muitos adultos também gostam.',
    passoAPasso: [],
    atencao: '',
    quandoPedirAjuda: ''
  }
};

const INTENCOES = [
  { id: 'incompreensivel', tipo: TIPOS_PUBLICOS.saudacao_ou_vaga, origem: 'habilidade_local', prioridade: 120, risco: false, limite: 1, termosFortes: ['tastando', 'pesquise me senhora', 'escusei me senhora', 'me senhora'], termosFracos: ['abc', 'oi'], resposta: RESPOSTAS.incompreensivel },
  { id: 'golpe_familiar_falso', tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', prioridade: 115, risco: true, limite: 9, termosFortes: ['foto do meu filho', 'foto do meu irmao', 'foto de familiar', 'numero novo dizendo que e minha mae', 'numero novo dizendo que e meu filho', 'outro numero', 'numero novo'], termosFracos: ['filho', 'filha', 'irmao', 'irma', 'mae', 'pai', 'familiar', 'parente', 'foto', 'pediu pix', 'pediu dinheiro', 'pedindo dinheiro', 'pedindo pix'], combinacoesCriticas: [['foto', 'familiar'], ['foto', 'dinheiro'], ['foto', 'pix'], ['numero novo', 'mae'], ['numero novo', 'filho'], ['outro numero', 'dinheiro'], ['familiar', 'dinheiro']], resposta: RESPOSTAS.golpe_familiar_falso },
  { id: 'pix_urgente_golpe', tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', prioridade: 110, risco: true, limite: 7, termosFortes: ['me pediram pix urgente', 'pediram dinheiro pelo whatsapp', 'numero pediu pix', 'pessoa pediu dinheiro', 'pediu pix urgente'], termosFracos: ['pix', 'dinheiro', 'urgente', 'whatsapp', 'pediram', 'pediu', 'pessoa'], combinacoesCriticas: [['pix', 'urgente'], ['dinheiro', 'whatsapp'], ['pediu', 'pix'], ['pediram', 'dinheiro']], resposta: RESPOSTAS.pix_urgente_golpe },
  { id: 'senha_whatsapp', tipo: TIPOS_PUBLICOS.seguranca, origem: 'habilidade_local', prioridade: 100, risco: true, limite: 7, termosFortes: ['senha no whatsapp', 'recuperar minha senha no whatsapp', 'esqueci minha senha no whatsapp', 'nao consigo entrar no whatsapp', 'perdi acesso ao whatsapp', 'codigo do whatsapp', 'recuperar conta do whatsapp'], termosFracos: ['senha', 'whatsapp', 'recuperar', 'entrar', 'perdi acesso', 'codigo', 'conta'], combinacoesCriticas: [['senha', 'whatsapp'], ['codigo', 'whatsapp'], ['recuperar', 'whatsapp'], ['entrar', 'whatsapp'], ['acesso', 'whatsapp']], resposta: RESPOSTAS.senha_whatsapp },
  { id: 'senha_banco', tipo: TIPOS_PUBLICOS.seguranca, origem: 'habilidade_local', prioridade: 98, risco: true, limite: 7, termosFortes: ['senha do banco', 'esqueci senha do banco', 'nao consigo entrar no app do banco', 'entrar no banco'], termosFracos: ['senha', 'banco', 'app do banco', 'entrar', 'bloqueou'], combinacoesCriticas: [['senha', 'banco'], ['entrar', 'banco']], resposta: RESPOSTAS.senha_banco },
  { id: 'senha_gov', tipo: TIPOS_PUBLICOS.seguranca, origem: 'habilidade_local', prioridade: 96, risco: true, limite: 7, termosFortes: ['senha do gov.br', 'esqueci senha do gov.br', 'recuperar gov.br', 'entrar no gov.br'], termosFracos: ['senha', 'gov.br', 'recuperar', 'entrar'], combinacoesCriticas: [['senha', 'gov.br'], ['recuperar', 'gov.br']], resposta: RESPOSTAS.senha_gov },
  { id: 'senha_facebook', tipo: TIPOS_PUBLICOS.seguranca, origem: 'habilidade_local', prioridade: 94, risco: true, limite: 7, termosFortes: ['senha do facebook', 'esqueci senha do facebook', 'nao consigo entrar no facebook', 'recuperar facebook'], termosFracos: ['senha', 'facebook', 'entrar', 'recuperar'], combinacoesCriticas: [['senha', 'facebook'], ['entrar', 'facebook']], resposta: RESPOSTAS.senha_facebook },
  { id: 'senha_instagram', tipo: TIPOS_PUBLICOS.seguranca, origem: 'habilidade_local', prioridade: 92, risco: true, limite: 7, termosFortes: ['senha do instagram', 'esqueci senha do instagram', 'nao consigo entrar no instagram', 'recuperar instagram'], termosFracos: ['senha', 'instagram', 'entrar', 'recuperar'], combinacoesCriticas: [['senha', 'instagram'], ['entrar', 'instagram']], resposta: RESPOSTAS.senha_instagram },
  { id: 'senha_email', tipo: TIPOS_PUBLICOS.seguranca, origem: 'habilidade_local', prioridade: 90, risco: true, limite: 7, termosFortes: ['senha do email', 'senha do e-mail', 'esqueci senha do email', 'recuperar email'], termosFracos: ['senha', 'email', 'e-mail', 'entrar', 'recuperar'], combinacoesCriticas: [['senha', 'email'], ['senha', 'e-mail']], resposta: RESPOSTAS.senha_email },
  { id: 'link_suspeito', tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', prioridade: 88, risco: true, limite: 5, termosFortes: ['recebi link estranho', 'cliquei em link', 'cliquei em um link', 'link no whatsapp', 'link de promocao', 'link suspeito'], termosFracos: ['link', 'estranho', 'suspeito', 'cliquei', 'promocao', 'whatsapp'], combinacoesCriticas: [['link', 'estranho'], ['link', 'whatsapp'], ['link', 'promocao'], ['cliquei', 'link']], resposta: RESPOSTAS.link_suspeito },
  { id: 'pix_como_fazer', tipo: TIPOS_PUBLICOS.seguranca, origem: 'habilidade_local', prioridade: 82, risco: true, limite: 5, termosFortes: ['como fazer pix', 'fazer um pix', 'enviar pix', 'pagar com pix', 'pix com seguranca'], termosFracos: ['pix', 'fazer', 'enviar', 'pagar', 'seguranca'], combinacoesCriticas: [['fazer', 'pix'], ['enviar', 'pix'], ['pagar', 'pix']], resposta: RESPOSTAS.pix_como_fazer },
  { id: 'loja_confiavel', tipo: TIPOS_PUBLICOS.consulta_loja_site, origem: 'seguranca_local', prioridade: 80, risco: true, limite: 5, termosFortes: ['loja e confiavel', 'site e confiavel', 'posso comprar nessa loja', 'preco muito barato'], termosFracos: ['loja', 'site', 'confiavel', 'comprar', 'preco', 'barato'], combinacoesCriticas: [['loja', 'confiavel'], ['site', 'confiavel'], ['preco', 'barato']], resposta: RESPOSTAS.loja_confiavel },
  { id: 'senha_generica', tipo: TIPOS_PUBLICOS.seguranca, origem: 'esclarecimento_local', prioridade: 70, risco: true, limite: 5, termosFortes: ['esqueci minha senha', 'nao consigo entrar', 'recuperar conta', 'minha conta bloqueou'], termosFracos: ['senha', 'entrar', 'recuperar', 'conta', 'bloqueou', 'acesso'], resposta: RESPOSTAS.senha_generica, naoCombinarCom: APLICATIVOS },
  { id: 'banco_generico', tipo: TIPOS_PUBLICOS.seguranca, origem: 'esclarecimento_local', prioridade: 66, risco: true, limite: 4, termosFortes: ['problema no banco', 'app do banco', 'como ver saldo', 'ver saldo'], termosFracos: ['banco', 'saldo', 'app', 'problema'], combinacoesCriticas: [['ver', 'saldo'], ['problema', 'banco']], resposta: RESPOSTAS.banco_generico },
  { id: 'whatsapp_mensagem', tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', prioridade: 60, risco: false, limite: 5, termosFortes: ['mandar mensagem no whatsapp', 'enviar mensagem no whatsapp'], termosFracos: ['mandar', 'enviar', 'mensagem', 'whatsapp'], combinacoesCriticas: [['mensagem', 'whatsapp']], resposta: RESPOSTAS.whatsapp_mensagem },
  { id: 'whatsapp_foto', tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', prioridade: 58, risco: false, limite: 5, termosFortes: ['colocar foto no whatsapp', 'foto no whatsapp', 'trocar foto do perfil'], termosFracos: ['foto', 'perfil', 'whatsapp', 'colocar', 'trocar'], combinacoesCriticas: [['foto', 'whatsapp']], resposta: RESPOSTAS.whatsapp_foto },
  { id: 'whatsapp_contato', tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', prioridade: 56, risco: false, limite: 5, termosFortes: ['salvar contato', 'adicionar contato', 'contato no whatsapp'], termosFracos: ['contato', 'whatsapp', 'salvar', 'adicionar'], combinacoesCriticas: [['contato', 'whatsapp']], resposta: RESPOSTAS.whatsapp_contato },
  { id: 'whatsapp_audio', tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', prioridade: 54, risco: false, limite: 5, termosFortes: ['mandar audio no whatsapp', 'enviar audio no whatsapp', 'gravar audio'], termosFracos: ['audio', 'whatsapp', 'mandar', 'enviar', 'gravar'], combinacoesCriticas: [['audio', 'whatsapp']], resposta: RESPOSTAS.whatsapp_audio },
  { id: 'whatsapp_generico', tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'esclarecimento_local', prioridade: 45, risco: false, limite: 4, termosFortes: ['whatsapp nao abre', 'duvida no whatsapp'], termosFracos: ['whatsapp', 'abre', 'duvida'], resposta: RESPOSTAS.whatsapp_generico },
  { id: 'celular_sem_som', tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', prioridade: 44, risco: false, limite: 5, termosFortes: ['celular esta sem som', 'sem som', 'nao sai som'], termosFracos: ['celular', 'som', 'silencioso'], combinacoesCriticas: [['sem', 'som'], ['celular', 'som']], resposta: RESPOSTAS.celular_sem_som },
  { id: 'celular_volume', tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', prioridade: 42, risco: false, limite: 4, termosFortes: ['aumentar o volume', 'volume do celular', 'aumentar o som'], termosFracos: ['volume', 'som', 'aumentar', 'baixo'], resposta: RESPOSTAS.celular_volume },
  { id: 'celular_wifi', tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', prioridade: 40, risco: false, limite: 4, termosFortes: ['conectar no wifi', 'conectar no wi-fi', 'entrar no wifi'], termosFracos: ['wifi', 'wi-fi', 'internet', 'conectar'], resposta: RESPOSTAS.celular_wifi },
  { id: 'celular_print', tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', prioridade: 38, risco: false, limite: 4, termosFortes: ['tirar print', 'captura de tela'], termosFracos: ['print', 'captura', 'tela'], resposta: RESPOSTAS.celular_print },
  { id: 'instalar_pwa', tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', prioridade: 36, risco: false, limite: 4, termosFortes: ['instalar na tela inicial', 'adicionar na tela inicial', 'instalar o sistema'], termosFracos: ['instalar', 'tela inicial', 'adicionar'], resposta: RESPOSTAS.instalar_pwa },
  { id: 'bob_esponja', tipo: TIPOS_PUBLICOS.duvida_geral, origem: 'resposta_local', prioridade: 34, risco: false, limite: 7, termosFortes: ['bob esponja', 'quem e o bob esponja'], termosFracos: ['bob', 'esponja', 'desenho'], combinacoesCriticas: [['bob', 'esponja']], resposta: RESPOSTAS.bob_esponja }
].sort((a, b) => b.prioridade - a.prioridade);

function temAlgum(t, termos = []) {
  return termos.some((termo) => t.includes(termo));
}

function contarCorrespondencias(t, termos = []) {
  return termos.filter((termo) => t.includes(termo)).length;
}

function temTodos(t, termos = []) {
  return termos.every((termo) => t.includes(termo));
}

function ehTextoCurtoSemIntencao(t = '') {
  const palavras = t.split(' ').filter(Boolean);
  if (['oi', 'ola', 'abc', 'teste', 'testando', 'tastando'].includes(t)) return true;
  if (palavras.length > 4) return false;

  const intencoesClaras = [
    'ajuda', 'aplicativo', 'app', 'banco', 'celular', 'codigo', 'conta', 'entrar', 'esqueci',
    'facebook', 'fazer', 'foto', 'golpe', 'instagram', 'link', 'pix', 'recuperar', 'senha',
    'whatsapp', 'quem', 'como', 'qual', 'porque', 'onde', 'volume', 'wifi', 'print', 'anime', 'manga'
  ];
  if (temAlgum(t, intencoesClaras)) return false;

  const conectivosSemPedido = new Set(['de', 'do', 'da', 'o', 'a', 'e', 'me', 'minha', 'minhas', 'senhora', 'por', 'favor']);
  const palavrasUteis = palavras.filter((palavra) => !conectivosSemPedido.has(palavra));
  return palavras.length <= 2 || palavrasUteis.length <= 1;
}

function ehPerguntaIncompreensivel(texto = '') {
  const t = normalizarTexto(texto);
  if (!t) return true;
  if (['pesquise me senhora', 'escusei me senhora', 'me senhora'].some((erro) => t === erro || t.includes(erro))) return true;
  return ehTextoCurtoSemIntencao(t);
}

function contemTermoRisco(texto = '') {
  return temAlgum(normalizarTexto(texto), TERMOS_RISCO);
}

function temDadoPessoal(texto = '') {
  return /(senha|cpf|cartao|documento|rg|codigo|token|pix|dados bancarios|banco)/i.test(normalizarTexto(texto));
}

function pontuarIntencao(t, intencao) {
  if (intencao.naoCombinarCom?.some((termo) => t.includes(termo))) return 0;

  let score = 0;
  score += contarCorrespondencias(t, intencao.termosFortes || []) * 5;
  score += contarCorrespondencias(t, intencao.termosFracos || []) * 2;
  score += (intencao.combinacoesCriticas || []).filter((grupo) => temTodos(t, grupo)).length * 8;

  if (intencao.risco && contemTermoRisco(t)) score += 3;
  if (intencao.tipo === TIPOS_PUBLICOS.seguranca) score += 2;

  return score;
}

function detectarIntencao(pergunta = '') {
  const textoNormalizado = normalizarTexto(pergunta);
  if (!textoNormalizado) return { ...INTENCOES.find((i) => i.id === 'incompreensivel'), score: 999, textoNormalizado };
  if (ehPerguntaIncompreensivel(textoNormalizado)) return { ...INTENCOES.find((i) => i.id === 'incompreensivel'), score: 999, textoNormalizado };

  let melhor = null;
  for (const intencao of INTENCOES.filter((i) => i.id !== 'incompreensivel')) {
    const score = pontuarIntencao(textoNormalizado, intencao);
    const limite = intencao.limite ?? 6;
    if (score < limite) continue;
    if (!melhor || score > melhor.score || (score === melhor.score && intencao.prioridade > melhor.prioridade)) {
      melhor = { ...intencao, score, textoNormalizado };
    }
  }

  if (!melhor) return null;

  if (contemTermoRisco(textoNormalizado)) {
    const melhorSeguranca = INTENCOES
      .filter((i) => i.tipo === TIPOS_PUBLICOS.seguranca || i.risco)
      .map((i) => ({ ...i, score: pontuarIntencao(textoNormalizado, i), textoNormalizado }))
      .filter((i) => i.score >= (i.limite ?? 6))
      .sort((a, b) => b.score - a.score || b.prioridade - a.prioridade)[0];
    return melhorSeguranca || melhor;
  }

  return melhor;
}

function respostaSegurancaGenerica() {
  return pacote(TIPOS_PUBLICOS.seguranca, respostaPadrao({
    respostaSimples: 'Esse assunto pode envolver golpe. Não envie dinheiro, senha ou código antes de confirmar.',
    passoAPasso: ['Pare e não faça pagamento agora.', 'Não clique em links.', 'Não envie senha, código, CPF, cartão ou documento.', 'Confirme por outro caminho, como ligação para número conhecido.', 'Peça ajuda a alguém de confiança.'],
    atencao: 'Com pressa é mais fácil cair em golpe.',
    quandoPedirAjuda: 'Peça ajuda antes de confirmar qualquer pagamento.'
  }), 'seguranca_local');
}

function respostaIntencaoLocal(intencao) {
  if (!intencao?.resposta) return null;
  return pacote(intencao.tipo, respostaPadrao(intencao.resposta), intencao.origem || 'habilidade_local');
}

function classificarIntencao(pergunta) {
  const t = normalizarTexto(pergunta);
  if (contemTermoRisco(t)) return TIPOS_PUBLICOS.seguranca;
  if (/(whatsapp|facebook|messenger|celular|internet|app|aplicativo|volume|wifi|foto|print)/.test(t)) return TIPOS_PUBLICOS.duvida_digital;
  return TIPOS_PUBLICOS.duvida_geral;
}

function carregarFaq() {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'faq.json'), 'utf8'));
}

function buscarContextoFaq(pergunta, limite = 4) {
  const q = normalizarTexto(pergunta);
  return carregarFaq()
    .filter((i) => normalizarTexto(`${i.categoria} ${i.pergunta} ${(i.palavrasChave || []).join(' ')}`).split(' ').some((tok) => tok && q.includes(tok)))
    .slice(0, limite);
}

function limitarRespostaGeral(resposta = {}) {
  const texto = limparCampoResposta(resposta.respostaSimples || '');
  const frases = texto.match(/[^.!?]+[.!?]?/g)?.map((f) => f.trim()).filter(Boolean).slice(0, 4) || [];
  return respostaPadrao({
    respostaSimples: frases.join(' ') || texto,
    passoAPasso: Array.isArray(resposta.passoAPasso) ? resposta.passoAPasso.slice(0, 4) : [],
    atencao: resposta.atencao || '',
    quandoPedirAjuda: resposta.quandoPedirAjuda || ''
  });
}

function parseIA(raw = '') {
  const semMarkdown = String(raw).replace(/```json|```/gi, '').trim();
  const i = semMarkdown.indexOf('{');
  const f = semMarkdown.lastIndexOf('}');
  const blocos = [semMarkdown, (i >= 0 && f > i) ? semMarkdown.slice(i, f + 1) : ''];
  for (const b of blocos) {
    if (!b) continue;
    try { return limitarRespostaGeral(JSON.parse(b)); } catch {}
  }
  if (semMarkdown.length > 10) return limitarRespostaGeral({ respostaSimples: semMarkdown, passoAPasso: [], atencao: '', quandoPedirAjuda: '' });
  return null;
}

async function chamarNvidia(pergunta, contextoFaq, intencao, historicoSeguro) {
  const system = 'Você é Sérgio, assistente acolhedor para idosos da OSSI. Responda em português simples. Para dúvida geral simples, responda naturalmente em 2 a 4 frases. Use linguagem simples. Só use passo a passo quando for ação prática. Não invente. Retorne SOMENTE JSON válido com: {"respostaSimples":"...","passoAPasso":[],"atencao":"","quandoPedirAjuda":""}.';
  const payload = {
    model: MODELO_NVIDIA,
    temperature: 0.2,
    max_tokens: 500,
    extra_body: { chat_template_kwargs: { enable_thinking: false } },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `Intenção: ${intencao}\nHistórico: ${JSON.stringify(historicoSeguro)}\nPergunta: ${pergunta}\nContexto FAQ: ${JSON.stringify(contextoFaq)}` }
    ]
  };
  const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) throw new Error('nvidia_http');
  const data = await resp.json();
  return parseIA(data?.choices?.[0]?.message?.content || '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const perguntaOriginal = String(req.body?.pergunta || '');
  const pergunta = normalizarTexto(perguntaOriginal);
  const historico = Array.isArray(req.body?.historico) ? req.body.historico : [];
  if (!pergunta.trim()) return res.status(400).json({ error: 'Pergunta inválida.' });

  const intencaoLocal = detectarIntencao(perguntaOriginal);
  if (intencaoLocal) return res.status(200).json(respostaIntencaoLocal(intencaoLocal));

  if (contemTermoRisco(pergunta)) return res.status(200).json(respostaSegurancaGenerica());

  const intencao = classificarIntencao(pergunta);
  if (!process.env.NVIDIA_API_KEY) {
    return res.status(200).json(pacote(TIPOS_PUBLICOS.fallback, respostaPadrao({
      respostaSimples: 'Agora estou sem IA online. Tente novamente em instantes.',
      passoAPasso: [],
      atencao: '',
      quandoPedirAjuda: ''
    }), 'local'));
  }

  try {
    const contexto = buscarContextoFaq(pergunta);
    const historicoSeguro = historico
      .slice(-6)
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && !temDadoPessoal(m.content))
      .map((m) => ({ role: m.role, content: m.content.slice(0, 280) }));
    const resposta = await chamarNvidia(pergunta, contexto, intencao, historicoSeguro);
    if (!resposta || !resposta.respostaSimples) throw new Error('ia_invalida');
    const tipo = intencao === TIPOS_PUBLICOS.duvida_digital ? TIPOS_PUBLICOS.duvida_digital : TIPOS_PUBLICOS.duvida_geral;
    return res.status(200).json(pacote(tipo, resposta, contexto.length ? 'ia_com_contexto' : 'ia'));
  } catch {
    return res.status(200).json(pacote(TIPOS_PUBLICOS.fallback, respostaPadrao({
      respostaSimples: 'Não consegui responder agora. Tente novamente em instantes.',
      passoAPasso: ['Você pode reformular a pergunta com calma.'],
      atencao: '',
      quandoPedirAjuda: 'Se for urgente, peça ajuda a alguém de confiança.'
    }), 'local'));
  }
}

export { INTENCOES, TIPOS_PUBLICOS, detectarIntencao, normalizarTexto, contemTermoRisco };
