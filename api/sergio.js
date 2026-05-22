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

function normalizarTexto(texto = '') { return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
function temDadoPessoal(texto = '') { return /(senha|cpf|cartao|documento|rg|codigo|token|pix|dados bancarios)/i.test(String(texto)); }

function limparCampoResposta(valor = '') {
  return String(valor).replace(/```json|```/gi, ' ').replace(/[{}\[\]"]/g, ' ').replace(/\\[nrt]/g, ' ').replace(/\\/g, ' ').replace(/\b(resposta\s*simples|respostasimples|passo\s*a\s*passo|passoapasso|atencao|aten[cç][aã]o|quando\s*pedir\s*ajuda|quandopedirajuda)\s*[:=-]?/gi, ' ').replace(/\s+/g, ' ').replace(/,\s*$/, '.').trim().slice(0, 420);
}

function respostaPadrao(resposta = {}, defaults = {}) {
  const base = {
    respostaSimples: limparCampoResposta(resposta.respostaSimples || defaults.respostaSimples || 'Não consegui entender bem. Pode perguntar de outro jeito?'),
    passoAPasso: Array.isArray(resposta.passoAPasso) ? resposta.passoAPasso.map((p) => limparCampoResposta(p)).filter(Boolean).slice(0, 6) : [],
    atencao: limparCampoResposta(resposta.atencao || defaults.atencao || ''),
    quandoPedirAjuda: limparCampoResposta(resposta.quandoPedirAjuda || defaults.quandoPedirAjuda || ''),
    opcoesFluxo: Array.isArray(resposta.opcoesFluxo) ? resposta.opcoesFluxo.map((o) => limparCampoResposta(o)).filter(Boolean).slice(0, 8) : []
  };
  const primeiroPasso = normalizarTexto(base.passoAPasso[0] || '');
  const respostaNorm = normalizarTexto(base.respostaSimples);
  if (primeiroPasso && respostaNorm && (primeiroPasso.includes(respostaNorm) || respostaNorm.includes(primeiroPasso))) base.passoAPasso = base.passoAPasso.slice(1);
  const atencaoNorm = normalizarTexto(base.atencao);
  const ajudaNorm = normalizarTexto(base.quandoPedirAjuda);
  if (atencaoNorm && ajudaNorm && (atencaoNorm.includes(ajudaNorm) || ajudaNorm.includes(atencaoNorm))) base.quandoPedirAjuda = '';
  return base;
}
const pacote = (tipo, resposta, origem) => ({ tipo, resposta, origem });

function temAlgum(t, termos) { return termos.some((x) => t.includes(x)); }


function respostaEsclarecimentoLocal(tipo = '') {
  const mapa = {
    senha_conta: { tipo: TIPOS_PUBLICOS.seguranca, origem: 'esclarecimento_local', resposta: { respostaSimples: 'Posso ajudar. Primeiro me diga de qual aplicativo ou conta você esqueceu a senha.', passoAPasso: ['Escolha uma opção abaixo ou escreva o nome do aplicativo.', 'Não envie sua senha para ninguém.', 'Não envie código recebido por SMS ou WhatsApp.'], atencao: 'Nunca compartilhe senha, código, CPF, cartão ou documento.', quandoPedirAjuda: 'Peça ajuda se aparecer cobrança, link estranho ou pedido de código.', opcoesFluxo: ['Facebook', 'Instagram', 'Gov.br', 'Banco', 'E-mail', 'WhatsApp', 'Outro aplicativo'] } },
    banco: { tipo: TIPOS_PUBLICOS.seguranca, origem: 'esclarecimento_local', resposta: { respostaSimples: 'Entendi. É problema para entrar no app, fazer Pix, ver saldo ou outro assunto?', passoAPasso: ['Escolha uma opção abaixo para eu explicar melhor.'], atencao: 'Nunca compartilhe senha ou código do banco.', quandoPedirAjuda: 'Peça ajuda antes de confirmar pagamento.', opcoesFluxo: ['Entrar no app', 'Fazer Pix', 'Ver saldo', 'Outro assunto'] } },
    whatsapp: { tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'esclarecimento_local', resposta: { respostaSimples: 'Você quer mandar mensagem, colocar foto, recuperar conta ou verificar golpe?', passoAPasso: ['Escolha uma opção abaixo para continuar.'], atencao: 'Não passe código de verificação do WhatsApp.', quandoPedirAjuda: '', opcoesFluxo: ['Mandar mensagem', 'Colocar foto', 'Recuperar conta', 'Verificar golpe'] } },
    celular: { tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'esclarecimento_local', resposta: { respostaSimples: 'Posso ajudar com celular. Escolha o problema.', passoAPasso: ['Escolha uma opção abaixo ou escreva o que aconteceu.'], atencao: '', quandoPedirAjuda: '', opcoesFluxo: ['Volume', 'Wi‑Fi', 'Print', 'Celular sem som', 'Outro problema'] } },
    loja_site: { tipo: TIPOS_PUBLICOS.consulta_loja_site, origem: 'esclarecimento_local', resposta: { respostaSimples: 'Qual é o nome ou site da loja?', passoAPasso: ['Confira se o endereço está correto.', 'Veja se tem CNPJ e contato real.', 'Desconfie de preço muito baixo.', 'Peça ajuda antes de pagar.'], atencao: 'Não envie documento para loja desconhecida.', quandoPedirAjuda: 'Peça ajuda se pedirem Pix com urgência.', opcoesFluxo: [] } },
    golpe: { tipo: TIPOS_PUBLICOS.seguranca, origem: 'esclarecimento_local', resposta: { respostaSimples: 'Me conte o que aconteceu para eu orientar com segurança.', passoAPasso: ['Não clique em link estranho.', 'Não passe senha nem código.', 'Não faça pagamento com pressa.'], atencao: 'Golpistas usam medo e urgência.', quandoPedirAjuda: 'Peça ajuda antes de pagar.', opcoesFluxo: ['Link estranho', 'Pedido de Pix', 'Conta invadida'] } }
  };
  const item = mapa[tipo];
  return item ? pacote(item.tipo, respostaPadrao(item.resposta), item.origem) : null;
}

function respostaSegurancaGenerica() {
  return pacote(TIPOS_PUBLICOS.seguranca, respostaPadrao({
    respostaSimples: 'Esse assunto envolve segurança. Vamos fazer com calma.',
    passoAPasso: ['Não clique em links desconhecidos.', 'Não envie senha, código, CPF, cartão ou documento.', 'Não faça Pix nem pagamento com pressa.', 'Abra apenas o aplicativo oficial.', 'Peça ajuda se estiver em dúvida.'],
    atencao: 'Com pressa é mais fácil cair em golpe.',
    quandoPedirAjuda: 'Peça ajuda antes de confirmar qualquer pagamento.'
  }), 'seguranca_local');
}

function responderHabilidadeLocal(pergunta = '') {
  const t = normalizarTexto(pergunta);
  const habilidades = [
    { tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'esclarecimento_local', termos: ['preciso de ajuda com meu celular', 'ajuda com celular'], resposta: respostaEsclarecimentoLocal('celular').resposta },
    { tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'esclarecimento_local', termos: ['estou com duvida no whatsapp', 'estou com dúvida no whatsapp', 'duvida no whatsapp', 'duvida whatsapp', 'whatsapp'], resposta: respostaEsclarecimentoLocal('whatsapp').resposta },
    { tipo: TIPOS_PUBLICOS.seguranca, origem: 'esclarecimento_local', termos: ['tenho uma duvida sobre pix ou banco e quero fazer com seguranca', 'tenho problema no banco', 'problema no banco'], resposta: respostaEsclarecimentoLocal('banco').resposta },
    { tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', termos: ['acho que estou passando por um golpe o que devo fazer'], resposta: { respostaSimples: 'Vamos com calma. Se você acha que é golpe, não clique em nada e não envie dinheiro.', passoAPasso: ['Pare e respire antes de agir.', 'Não clique em links recebidos.', 'Não passe senha, código ou documento.', 'Bloqueie o contato suspeito e denuncie no aplicativo.'], atencao: 'Golpistas usam urgência para pressionar.', quandoPedirAjuda: 'Peça ajuda a alguém de confiança antes de qualquer pagamento.' } },
    { tipo: TIPOS_PUBLICOS.duvida_geral, origem: 'habilidade_local', termos: ['tenho uma duvida do dia a dia'], resposta: { respostaSimples: 'Pode me perguntar. Vou tentar explicar de um jeito simples.', passoAPasso: ['Escreva sua dúvida com calma.', 'Se quiser, pergunte algo específico como: O que é anime? ou Como pesquisar no Google?'], atencao: '', quandoPedirAjuda: '' } },
    { tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', termos: ['aumentar o volume', 'aumentar o som', 'nao escuto', 'celular esta baixo', 'volume do celular'], resposta: { respostaSimples: 'Vamos aumentar o volume com calma.', passoAPasso: ['Pegue o celular na mão.', 'Aperte o botão de cima na lateral.', 'Veja se a barra de volume aparece na tela.', 'Teste o som com um vídeo curto.', 'Se ainda estiver baixo, abra Configurações e toque em Som.', 'Peça ajuda se o botão não funcionar.'], atencao: 'Não instale aplicativo desconhecido para aumentar som.', quandoPedirAjuda: '' } },
    { tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', termos: ['foto no whatsapp', 'trocar foto do perfil', 'mudar foto do zap', 'colocar foto no perfil'], resposta: { respostaSimples: 'Você pode trocar a foto do WhatsApp em poucos toques.', passoAPasso: ['Abra o WhatsApp.', 'Toque em Configurações.', 'Toque no seu nome ou na sua foto.', 'Toque no ícone de câmera.', 'Escolha uma foto da galeria.', 'Toque em confirmar.'], atencao: 'Evite usar foto com documento ou dados pessoais.', quandoPedirAjuda: '' } },
    { tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', termos: ['mandar mensagem no whatsapp', 'enviar mensagem no whatsapp'], resposta: { respostaSimples: 'Mandar mensagem no WhatsApp é rápido e simples.', passoAPasso: ['Abra o WhatsApp.', 'Toque na conversa da pessoa.', 'Digite sua mensagem.', 'Toque na seta para enviar.', 'Confirme se a mensagem apareceu na conversa.'], atencao: 'Confira o nome da pessoa antes de enviar informação importante.', quandoPedirAjuda: '' } },
    { tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', termos: ['nao consigo entrar no facebook', 'não consigo entrar no facebook', 'esqueci senha do facebook', 'esqueci a senha do facebook', 'entrar no face', 'recuperar facebook'], resposta: { respostaSimples: 'Para recuperar o Facebook, use apenas o aplicativo ou site oficial.', passoAPasso: ['Abra o aplicativo oficial do Facebook.', 'Toque em Esqueci a senha.', 'Digite seu e-mail ou telefone.', 'Siga o código enviado para você.', 'Crie uma senha nova.', 'Não passe o código para ninguém.'], atencao: 'Nunca compartilhe senha ou código.', quandoPedirAjuda: 'Peça ajuda se aparecer link estranho ou cobrança.' } },
    { tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', termos: ['esqueci senha do instagram', 'esqueci a senha do instagram', 'não consigo entrar no instagram', 'nao consigo entrar no instagram', 'recuperar instagram'], resposta: { respostaSimples: 'Para recuperar o Instagram, use só o aplicativo oficial.', passoAPasso: ['Abra o Instagram.', 'Toque em Esqueceu a senha?.', 'Digite seu e-mail, usuário ou telefone.', 'Siga o código enviado para você.', 'Crie uma senha nova.', 'Não compartilhe o código.'], atencao: 'Não envie senha nem código.', quandoPedirAjuda: 'Peça ajuda se pedirem pagamento para recuperar conta.' } },
    { tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', termos: ['esqueci senha do gov', 'esqueci senha do gov.br', 'esqueci a senha do gov.br', 'não consigo entrar no gov.br', 'nao consigo entrar no gov.br', 'recuperar gov.br'], resposta: { respostaSimples: 'No Gov.br, use apenas o app ou site oficial para recuperar acesso.', passoAPasso: ['Abra o app Gov.br ou o site oficial.', 'Toque em Esqueci minha senha.', 'Informe CPF e siga as opções seguras.', 'Use o código de segurança recebido.', 'Crie nova senha forte.', 'Não compartilhe código com ninguém.'], atencao: 'Use apenas canais oficiais do Gov.br.', quandoPedirAjuda: 'Peça ajuda em posto oficial se não conseguir entrar.' } },
    { tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', termos: ['esqueci senha do banco', 'esqueci a senha do banco', 'não consigo entrar no banco', 'nao consigo entrar no banco', 'senha do aplicativo do banco'], resposta: { respostaSimples: 'Para senha do banco, use apenas o aplicativo oficial.', passoAPasso: ['Abra o app oficial do banco.', 'Toque em Esqueci minha senha.', 'Siga as etapas do próprio banco.', 'Não clique em link recebido por mensagem.', 'Se tiver dúvida, fale com a agência ou equipe oficial.', 'Peça ajuda a familiar de confiança se precisar.'], atencao: 'Nunca passe senha ou código do banco.', quandoPedirAjuda: 'Peça ajuda antes de confirmar pagamento ou transferência.' } },
    { tipo: TIPOS_PUBLICOS.seguranca, origem: 'esclarecimento_local', termos: ['esqueci minha senha', 'esqueci a senha', 'nao consigo entrar', 'não consigo entrar', 'perdi minha senha', 'recuperar conta', 'minha conta bloqueou', 'conta bloqueada'], resposta: respostaEsclarecimentoLocal('senha_conta').resposta },
    { tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', termos: ['esqueci senha do email', 'esqueci a senha do email', 'esqueci senha do e-mail', 'esqueci a senha do e-mail', 'não consigo entrar no gmail', 'nao consigo entrar no gmail', 'não consigo entrar no email', 'nao consigo entrar no email'], resposta: { respostaSimples: 'Para recuperar e-mail, use só o aplicativo ou site oficial do serviço.', passoAPasso: ['Abra o Gmail ou outro e-mail oficial.', 'Toque em Esqueci minha senha.', 'Digite o e-mail ou telefone de recuperação.', 'Use o código de segurança recebido.', 'Crie uma nova senha.', 'Não compartilhe o código.'], atencao: 'Não passe senha nem código por mensagem.', quandoPedirAjuda: 'Peça ajuda se aparecer link estranho.' } },
    { tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', termos: ['pix urgente', 'pediram pix', 'pedido de dinheiro'], resposta: { respostaSimples: 'Pedido urgente de Pix pode ser golpe.', passoAPasso: ['Pare e respire antes de qualquer pagamento.', 'Confirme por ligação no número que você já conhece.', 'Não envie código, senha, foto ou documento.', 'Não clique em link recebido por mensagem.', 'Se suspeitar, bloqueie o contato e denuncie.'], atencao: 'Golpistas usam urgência para pressionar.', quandoPedirAjuda: 'Peça ajuda antes de qualquer transferência.' } },
    { tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', termos: ['como fazer pix', 'fazer um pix', 'preciso fazer pix', 'mandar pix', 'enviar pix', 'pagar com pix'], resposta: { respostaSimples: 'Para fazer Pix, use somente o aplicativo oficial do seu banco. Faça com calma e confirme o nome da pessoa antes de pagar.', passoAPasso: ['Abra o aplicativo oficial do seu banco.', 'Toque na opção Pix.', 'Escolha pagar por chave Pix ou QR Code.', 'Digite a chave ou leia o QR Code.', 'Confira o nome da pessoa que vai receber.', 'Confira o valor e só confirme se tiver certeza.'], atencao: 'Nunca faça Pix com pressa. Desconfie de pedido urgente, link estranho ou pessoa pedindo dinheiro pelo WhatsApp.', quandoPedirAjuda: 'Peça ajuda antes de confirmar se for valor alto, pessoa desconhecida ou pedido urgente.' } },
    { tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', termos: ['banco e pix com seguranca', 'pix com seguranca', 'seguranca no banco', 'duvida sobre pix ou banco'], resposta: { respostaSimples: 'No banco, faça tudo com calma e use só o aplicativo oficial.', passoAPasso: ['Abra apenas o aplicativo oficial do seu banco.', 'Não clique em link recebido por mensagem.', 'Não passe senha, código ou token para ninguém.', 'Confirme o nome da pessoa antes de qualquer Pix.', 'Pare e peça ajuda se sentir medo ou pressão.'], atencao: 'Golpistas tentam apressar você para errar.', quandoPedirAjuda: '' } },
    { tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', termos: ['link estranho', 'link suspeito'], resposta: { respostaSimples: 'Link estranho pode roubar seus dados.', passoAPasso: ['Não clique no link.', 'Se clicou, não preencha nada.', 'Abra o aplicativo oficial digitando o endereço manualmente.', 'Troque sua senha se digitou informação.'], atencao: 'Nunca informe senha, CPF ou cartão em link desconhecido.', quandoPedirAjuda: '' } },
    { tipo: TIPOS_PUBLICOS.consulta_loja_site, origem: 'esclarecimento_local', termos: ['loja confiavel', 'site confiavel', 'loja e confiavel', 'site e confiavel', 'a loja e confiavel', 'a loja é confiável'], resposta: respostaEsclarecimentoLocal('loja_site').resposta },
    { tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', termos: ['numero desconhecido', 'foto de familiar', 'se passando por familiar'], resposta: { respostaSimples: 'Não confie só na foto do perfil.', passoAPasso: ['Pare e não envie dinheiro.', 'Ligue para o familiar no número antigo salvo.', 'Se confirmar golpe, bloqueie o contato.', 'Denuncie o número no aplicativo.'], atencao: 'Golpe com foto de familiar é comum.', quandoPedirAjuda: 'Peça ajuda antes de transferir dinheiro.' } },
    { tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', termos: ['tela inicial', 'instalar o sistema'], resposta: { respostaSimples: 'Você pode adicionar o sistema na tela inicial.', passoAPasso: ['No Android, toque nos três pontos do navegador.', 'Toque em Adicionar à tela inicial.', 'No iPhone, toque em Compartilhar.', 'Toque em Adicionar à Tela de Início.'], atencao: '', quandoPedirAjuda: '' } },
    { tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', termos: ['tirar print', 'captura de tela'], resposta: { respostaSimples: 'Para tirar print, use os botões do celular.', passoAPasso: ['Abra a tela que deseja salvar.', 'Aperte juntos o botão de ligar e volume para baixo.', 'Procure a imagem na galeria.', 'Compartilhe só com pessoa de confiança.'], atencao: '', quandoPedirAjuda: '' } },
    { tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', termos: ['conectar no wifi', 'conectar no wi-fi', 'entrar no wifi'], resposta: { respostaSimples: 'Você pode conectar no Wi-Fi pelas configurações.', passoAPasso: ['Abra Configurações.', 'Toque em Wi‑Fi.', 'Escolha a rede da sua casa.', 'Digite a senha e confirme.', 'Espere aparecer Conectado.'], atencao: 'Evite rede aberta desconhecida.', quandoPedirAjuda: '' } }
  ];

  const hit = habilidades.find((h) => temAlgum(t, h.termos));
  return hit ? pacote(hit.tipo, respostaPadrao(hit.resposta), hit.origem) : null;
}

function classificarIntencao(pergunta) {
  const t = normalizarTexto(pergunta);
  if (!t || ['boa', 'bom dia', 'boa tarde', 'boa noite', 'oi', 'ola'].includes(t)) return 'saudacao_ou_vaga';
  if (/(senha|recuperar conta|esqueci|minha conta|pix|banco|dinheiro|codigo|token|link|suspeito|loja|golpe|numero desconhecido|documento)/.test(t)) return 'seguranca';
  if (/(whatsapp|facebook|messenger|celular|internet|app|aplicativo|volume|wifi|foto|print)/.test(t)) return 'duvida_digital';
  return 'duvida_geral';
}

function carregarFaq() { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'faq.json'), 'utf8')); }
function buscarContextoFaq(pergunta, limite = 4) { const q = normalizarTexto(pergunta); return carregarFaq().filter((i) => normalizarTexto(`${i.categoria} ${i.pergunta} ${(i.palavrasChave || []).join(' ')}`).split(' ').some((tok) => tok && q.includes(tok))).slice(0, limite); }

function parseIA(raw = '') {
  const semMarkdown = String(raw).replace(/```json|```/gi, '').trim();
  const i = semMarkdown.indexOf('{'); const f = semMarkdown.lastIndexOf('}');
  const blocos = [semMarkdown, (i >= 0 && f > i) ? semMarkdown.slice(i, f + 1) : ''];
  for (const b of blocos) {
    if (!b) continue;
    try { return respostaPadrao(JSON.parse(b)); } catch {}
  }
  if (semMarkdown.length > 10) return respostaPadrao({ respostaSimples: semMarkdown, passoAPasso: [], atencao: '', quandoPedirAjuda: '' });
  return null;
}

async function chamarNvidia(pergunta, contextoFaq, intencao, historicoSeguro) {
  const system = 'Você é Sérgio, assistente acolhedor para idosos da OSSI. Responda em português simples. Para dúvida geral simples, responda naturalmente em 2 a 4 frases. Só use passo a passo quando for ação prática. Não invente passo a passo inútil. Retorne SOMENTE JSON válido com: {"respostaSimples":"...","passoAPasso":[],"atencao":"","quandoPedirAjuda":""}.';
  const payload = { model: MODELO_NVIDIA, temperature: 0.2, max_tokens: 700, extra_body: { chat_template_kwargs: { enable_thinking: false } }, messages: [{ role: 'system', content: system }, { role: 'user', content: `Intenção: ${intencao}\nHistórico: ${JSON.stringify(historicoSeguro)}\nPergunta: ${pergunta}\nContexto FAQ: ${JSON.stringify(contextoFaq)}` }] };
  const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!resp.ok) throw new Error('nvidia_http');
  const data = await resp.json();
  return parseIA(data?.choices?.[0]?.message?.content || '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const pergunta = String(req.body?.pergunta || '');
  const historico = Array.isArray(req.body?.historico) ? req.body.historico : [];
  if (!pergunta.trim()) return res.status(400).json({ error: 'Pergunta inválida.' });

  const habilidade = responderHabilidadeLocal(pergunta);
  if (habilidade) return res.status(200).json(habilidade);

  const intencao = classificarIntencao(pergunta);
  if (intencao === 'saudacao_ou_vaga') return res.status(200).json(pacote(TIPOS_PUBLICOS.saudacao_ou_vaga, respostaPadrao({ respostaSimples: 'Olá! Eu sou o Sérgio. Pode me contar sua dúvida.', passoAPasso: ['Escreva com palavras simples.', 'Se quiser, diga o nome do aplicativo.'] }), 'local'));
  if (intencao === 'seguranca') return res.status(200).json(respostaSegurancaGenerica());

  if (!process.env.NVIDIA_API_KEY) return res.status(200).json(pacote(TIPOS_PUBLICOS.fallback, respostaPadrao({ respostaSimples: 'Agora estou sem IA online. Tente novamente em instantes.', passoAPasso: [], atencao: '', quandoPedirAjuda: '' }), 'local'));

  try {
    const contexto = buscarContextoFaq(pergunta);
    const historicoSeguro = historico.slice(-6).filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && !temDadoPessoal(m.content)).map((m) => ({ role: m.role, content: m.content.slice(0, 280) }));
    const resposta = await chamarNvidia(pergunta, contexto, intencao, historicoSeguro);
    if (!resposta || !resposta.respostaSimples) throw new Error('ia_invalida');
    const tipo = intencao === 'duvida_digital' ? TIPOS_PUBLICOS.duvida_digital : TIPOS_PUBLICOS.duvida_geral;
    return res.status(200).json(pacote(tipo, resposta, contexto.length ? 'ia_com_contexto' : 'ia'));
  } catch {
    return res.status(200).json(pacote(TIPOS_PUBLICOS.fallback, respostaPadrao({
      respostaSimples: 'Não consegui responder agora. Tente novamente em instantes.', passoAPasso: ['Você pode reformular a pergunta com calma.'], atencao: '', quandoPedirAjuda: 'Se for urgente, peça ajuda a alguém de confiança.'
    }), 'local'));
  }
}
