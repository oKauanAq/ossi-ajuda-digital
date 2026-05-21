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
  return String(valor).replace(/```json|```/gi, ' ').replace(/[{}\[\]"]/g, ' ').replace(/\\[nrt]/g, ' ').replace(/\\/g, ' ').replace(/\b(resposta\s*simples|respostasimples|passo\s*a\s*passo|passoapasso|atencao|aten[cç][aã]o|quando\s*pedir\s*ajuda|quandopedirajuda)\s*[:=-]?/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 420);
}

function respostaPadrao(resposta = {}, defaults = {}) {
  return {
    respostaSimples: limparCampoResposta(resposta.respostaSimples || defaults.respostaSimples || 'Não consegui entender bem. Pode perguntar de outro jeito?'),
    passoAPasso: Array.isArray(resposta.passoAPasso) ? resposta.passoAPasso.map((p) => limparCampoResposta(p)).filter(Boolean).slice(0, 6) : [],
    atencao: limparCampoResposta(resposta.atencao || defaults.atencao || ''),
    quandoPedirAjuda: limparCampoResposta(resposta.quandoPedirAjuda || defaults.quandoPedirAjuda || '')
  };
}
const pacote = (tipo, resposta, origem) => ({ tipo, resposta, origem });

function temAlgum(t, termos) { return termos.some((x) => t.includes(x)); }

function responderHabilidadeLocal(pergunta = '') {
  const t = normalizarTexto(pergunta);
  const habilidades = [
    { tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', termos: ['aumentar o volume', 'aumentar o som', 'nao escuto', 'celular esta baixo', 'volume do celular'], resposta: { respostaSimples: 'Use os botões de volume na lateral do celular. O botão de cima geralmente aumenta o som.', passoAPasso: ['Pegue o celular na mão.', 'Procure os botões na lateral.', 'Aperte o botão de cima para aumentar.', 'Veja se aparece uma barra de volume na tela.', 'Se ainda estiver baixo, abra Configurações > Som.', 'Peça ajuda se não encontrar.'], atencao: 'Não instale aplicativos prometendo aumentar o volume sem orientação.', quandoPedirAjuda: 'Peça ajuda se o botão não funcionar ou se o celular continuar sem som.' } },
    { tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', termos: ['foto no whatsapp', 'trocar foto do perfil', 'mudar foto do zap', 'colocar foto no perfil'], resposta: { respostaSimples: 'Você consegue trocar sua foto de perfil do WhatsApp em poucos toques.', passoAPasso: ['Abra o WhatsApp.', 'Toque nos três pontinhos ou em Configurações.', 'Toque no seu nome ou na sua foto.', 'Toque na câmera ou no lápis.', 'Escolha uma foto da galeria.', 'Confirme.'], atencao: 'Evite colocar foto de documento, cartão ou informação pessoal.', quandoPedirAjuda: 'Peça ajuda se não encontrar as opções no seu celular.' } },
    { tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', termos: ['mandar mensagem no whatsapp', 'enviar mensagem no whatsapp'], resposta: { respostaSimples: 'Você pode enviar mensagem no WhatsApp de forma simples.', passoAPasso: ['Abra o WhatsApp.', 'Toque em uma conversa ou no ícone de nova conversa.', 'Digite a mensagem no campo de texto.', 'Toque na seta de enviar.', 'Confirme se apareceu o tique da mensagem.'], atencao: 'Revise o nome do contato antes de enviar dados importantes.', quandoPedirAjuda: '' } },
    { tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', termos: ['mandar mensagem no facebook', 'messenger'], resposta: { respostaSimples: 'No Facebook/Messenger, abra a conversa e toque em enviar.', passoAPasso: ['Abra o Messenger ou Facebook.', 'Toque em Conversas ou no ícone de mensagem.', 'Escolha o contato.', 'Digite a mensagem.', 'Toque em Enviar.'], atencao: '', quandoPedirAjuda: 'Peça ajuda se aparecer pedido de código ou dinheiro.' } },
    { tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', termos: ['esqueci minha senha', 'nao consigo entrar', 'não consigo entrar', 'recuperar conta', 'entrar no face'], resposta: { respostaSimples: 'Use a opção oficial “Esqueci minha senha” no aplicativo ou site.', passoAPasso: ['Abra o app oficial da conta.', 'Toque em “Esqueci minha senha”.', 'Siga a recuperação pelo seu e-mail ou telefone.', 'Crie senha nova forte e diferente.', 'Nunca passe código recebido por SMS para ninguém.'], atencao: 'Nunca informe senha ou código para outra pessoa.', quandoPedirAjuda: 'Peça ajuda se receber link estranho ou pedido de pagamento para recuperar conta.' } },
    { tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', termos: ['pix urgente', 'pediram pix', 'pedido de dinheiro'], resposta: { respostaSimples: 'Pedido urgente de Pix pode ser golpe.', passoAPasso: ['Pare e não faça o Pix na pressa.', 'Confirme por ligação no número que você já conhece.', 'Não envie código, documento ou foto.', 'Se suspeitar, bloqueie o contato e denuncie.'], atencao: 'Golpistas usam urgência para pressionar.', quandoPedirAjuda: 'Peça ajuda antes de qualquer transferência.' } },
    { tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', termos: ['link estranho', 'link suspeito'], resposta: { respostaSimples: 'Link estranho pode roubar seus dados.', passoAPasso: ['Não clique no link.', 'Se clicou, não preencha dados.', 'Abra o app oficial digitando o endereço manualmente.', 'Troque sua senha se digitou informações.'], atencao: 'Nunca informe senha, CPF ou cartão em link desconhecido.', quandoPedirAjuda: '' } },
    { tipo: TIPOS_PUBLICOS.consulta_loja_site, origem: 'seguranca_local', termos: ['loja confiavel', 'site confiavel', 'loja e confiavel', 'site e confiavel'], resposta: { respostaSimples: 'Você pode verificar sinais de confiança antes de comprar.', passoAPasso: ['Confira se o endereço do site está correto.', 'Procure CNPJ, telefone e política de troca.', 'Pesquise o nome da loja no Reclame Aqui.', 'Desconfie de preço muito abaixo do normal.', 'Evite Pix se estiver inseguro.'], atencao: 'Não envie documento para loja desconhecida.', quandoPedirAjuda: 'Peça ajuda antes de pagar se tiver dúvida.' } },
    { tipo: TIPOS_PUBLICOS.seguranca, origem: 'seguranca_local', termos: ['numero desconhecido', 'foto de familiar', 'se passando por familiar'], resposta: { respostaSimples: 'Não confie só na foto do perfil.', passoAPasso: ['Pare e não envie dinheiro.', 'Ligue para o familiar no número antigo salvo.', 'Bloqueie se confirmar suspeita.'], atencao: '', quandoPedirAjuda: 'Peça ajuda antes de qualquer transferência.' } },
    { tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', termos: ['tela inicial', 'instalar o sistema'], resposta: { respostaSimples: 'Você pode adicionar o sistema na tela inicial.', passoAPasso: ['No Android (Chrome), toque nos 3 pontos e em “Adicionar à tela inicial”.', 'No iPhone (Safari), toque em compartilhar e em “Adicionar à Tela de Início”.'], atencao: '', quandoPedirAjuda: '' } },
    { tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', termos: ['tirar print', 'captura de tela'], resposta: { respostaSimples: 'Para tirar print, use os botões físicos do celular.', passoAPasso: ['Abra a tela que deseja salvar.', 'Aperte ao mesmo tempo botão de ligar + volume para baixo.', 'Procure a imagem na galeria.'], atencao: '', quandoPedirAjuda: '' } },
    { tipo: TIPOS_PUBLICOS.duvida_digital, origem: 'habilidade_local', termos: ['conectar no wifi', 'conectar no wi-fi', 'entrar no wifi'], resposta: { respostaSimples: 'Você pode conectar no Wi-Fi pelas configurações.', passoAPasso: ['Abra Configurações.', 'Toque em Wi‑Fi.', 'Escolha a rede da sua casa.', 'Digite a senha do Wi‑Fi e confirme.'], atencao: 'Evite redes abertas desconhecidas.', quandoPedirAjuda: '' } }
  ];

  const hit = habilidades.find((h) => temAlgum(t, h.termos));
  return hit ? pacote(hit.tipo, respostaPadrao(hit.resposta), hit.origem) : null;
}

function classificarIntencao(pergunta) {
  const t = normalizarTexto(pergunta);
  if (!t || ['boa', 'bom dia', 'boa tarde', 'boa noite', 'oi', 'ola'].includes(t)) return 'saudacao_ou_vaga';
  if (/(senha|recuperar conta|esqueci|minha conta|pix|banco|dinheiro|link|suspeito|site confiavel|loja confiavel)/.test(t)) return 'seguranca';
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

  if (!process.env.NVIDIA_API_KEY) return res.status(200).json(pacote(TIPOS_PUBLICOS.fallback, respostaPadrao({ respostaSimples: 'Agora estou sem IA online. Tente novamente em instantes.', passoAPasso: [], atencao: '', quandoPedirAjuda: '' }), 'local'));

  try {
    const contexto = buscarContextoFaq(pergunta);
    const historicoSeguro = historico.slice(-6).filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && !temDadoPessoal(m.content)).map((m) => ({ role: m.role, content: m.content.slice(0, 280) }));
    const resposta = await chamarNvidia(pergunta, contexto, intencao, historicoSeguro);
    if (!resposta || !resposta.respostaSimples) throw new Error('ia_invalida');
    const tipo = intencao === 'duvida_digital' ? TIPOS_PUBLICOS.duvida_digital : TIPOS_PUBLICOS.duvida_geral;
    return res.status(200).json(pacote(tipo, resposta, contexto.length ? 'faq' : 'ia'));
  } catch {
    return res.status(200).json(pacote(TIPOS_PUBLICOS.fallback, respostaPadrao({
      respostaSimples: 'Não consegui responder agora. Tente novamente em instantes.', passoAPasso: ['Você pode reformular a pergunta com calma.'], atencao: '', quandoPedirAjuda: 'Se for urgente, peça ajuda a alguém de confiança.'
    }), 'local'));
  }
}
