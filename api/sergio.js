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
function temDadoPessoal(texto = '') { return /(senha|cpf|cartao|cartao|documento|rg|codigo|token|pix|dados bancarios)/i.test(String(texto)); }

function respostaPadrao(resposta = {}, defaults = {}) {
  return {
    respostaSimples: String(resposta.respostaSimples || defaults.respostaSimples || 'Vamos resolver isso com calma.'),
    passoAPasso: Array.isArray(resposta.passoAPasso) ? resposta.passoAPasso.map(String).filter(Boolean).slice(0, 6) : (defaults.passoAPasso || []),
    atencao: String(resposta.atencao || defaults.atencao || 'Não compartilhe dados pessoais.'),
    quandoPedirAjuda: String(resposta.quandoPedirAjuda || defaults.quandoPedirAjuda || 'Peça ajuda se tiver dúvida.')
  };
}
const pacote = (tipo, resposta, origem) => ({ tipo, resposta, origem });

function classificarIntencao(pergunta) {
  const t = normalizarTexto(pergunta);
  if (!t || ['boa', 'bom dia', 'boa tarde', 'boa noite', 'oi', 'ola', 'me ajuda', 'me tire uma duvida', 'tenho uma duvida'].includes(t)) return 'saudacao_ou_vaga';
  if (/(senha|recuperar conta|esqueci|minha conta)/.test(t)) return 'seguranca_senha_recuperacao';
  if (/(codigo|token|sms|verificacao)/.test(t)) return 'seguranca_codigo_token';
  if (/(pix|banco|dinheiro|transferencia)/.test(t)) return 'seguranca_pix_banco_dinheiro';
  if (/(numero desconhecido|perfil falso|se passando|rosto do meu)/.test(t)) return 'seguranca_numero_desconhecido_perfil_falso';
  if (/(link|site estranho|encurtado|cliquei)/.test(t)) return 'seguranca_link_suspeito';
  if (/(loja|site confiavel|site confiavel\?|confiavel\?|confiavel)/.test(t)) return 'consulta_loja_site_confiavel';
  if (/(cpf|cartao|documento|rg)/.test(t)) return 'documento_dados_pessoais';
  if (/(saude|remedio|dor|sintoma)/.test(t)) return 'saude';
  if (/(whatsapp|facebook|messenger|celular|internet|app|aplicativo|volume|wifi|foto)/.test(t)) return 'duvida_digital';
  return 'duvida_geral';
}

function respostaSeguranca(tipoInterno) {
  const base = { atencao: 'Nunca passe senha, código, CPF, cartão, documento ou dados bancários.', quandoPedirAjuda: 'Se houver risco, pedido de dinheiro ou dúvida, peça ajuda a alguém de confiança ou à equipe da OSSI.' };
  const map = {
    seguranca_senha_recuperacao: { respostaSimples: 'Você pode recuperar a conta com segurança.', passoAPasso: ['Use "Esqueci minha senha" no app ou site oficial.', 'Não passe código para ninguém.', 'Não clique em link enviado por desconhecido.', 'Se pedirem pagamento ou código, pare e peça ajuda.'] },
    seguranca_codigo_token: { respostaSimples: 'Código de verificação é secreto.', passoAPasso: ['Nunca compartilhe código ou token.', 'Digite código só no app oficial aberto por você.', 'Se recebeu sem pedir, troque a senha.', 'Ative verificação em duas etapas.'] },
    seguranca_pix_banco_dinheiro: { respostaSimples: 'Pedido urgente de Pix pode ser golpe.', passoAPasso: ['Não faça Pix na pressa.', 'Confirme por ligação no número já salvo.', 'Não envie dinheiro, código ou documento.', 'Se parecer golpe, bloqueie e denuncie.'] },
    seguranca_numero_desconhecido_perfil_falso: { respostaSimples: 'Não confie só na foto do perfil.', passoAPasso: ['Ligue para seu irmão no número antigo salvo.', 'Não envie dinheiro, código ou documento.', 'Bloqueie e denuncie se parecer falso.', 'Peça ajuda antes de agir.'] },
    seguranca_link_suspeito: { respostaSimples: 'Link suspeito pode ser golpe.', passoAPasso: ['Não clique no link.', 'Se clicou, não informe dados.', 'Abra o app/site oficial digitando o endereço.', 'Troque senha se digitou algo.'] },
    documento_dados_pessoais: { respostaSimples: 'Proteja seus dados pessoais.', passoAPasso: ['Não envie CPF, cartão ou documento para desconhecidos.', 'Use só canais oficiais.', 'Se houver pressão, pare.', 'Peça ajuda antes de enviar.'] },
    saude: { respostaSimples: 'Em saúde, use orientação profissional.', passoAPasso: ['Posso ajudar com informação geral.', 'Para sintomas fortes, procure atendimento médico.', 'Não use remédio sem orientação.', 'Em emergência, ligue para urgência local.'] }
  };
  return respostaPadrao({ ...base, ...(map[tipoInterno] || map.seguranca_link_suspeito) });
}

function carregarFaq() { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'faq.json'), 'utf8')); }
function buscarContextoFaq(pergunta, limite = 4) {
  const q = normalizarTexto(pergunta);
  return carregarFaq().filter((i) => normalizarTexto(`${i.categoria} ${i.pergunta} ${(i.palavrasChave || []).join(' ')}`).split(' ').some((tok) => tok && q.includes(tok))).slice(0, limite);
}

function parseIA(raw = '') {
  const text = String(raw).replace(/```json/gi, '').replace(/```/g, '').trim();
  const i = text.indexOf('{'); const f = text.lastIndexOf('}');
  const candidates = [text, (i >= 0 && f > i) ? text.slice(i, f + 1) : ''];
  for (const c of candidates) { if (!c) continue; try { return respostaPadrao(JSON.parse(c)); } catch {} }
  return respostaPadrao({ respostaSimples: text.slice(0, 260), passoAPasso: ['Siga com calma.', 'Se houver risco, pare e peça ajuda.'] });
}

async function chamarNvidia(pergunta, contextoFaq, intencao, historicoSeguro) {
  const system = 'Você é Sérgio, um chatbot de IA acolhedor para idosos da OSSI. Converse de forma simples, paciente e segura. Você pode responder dúvidas gerais do dia a dia, mas tem especialidade em inclusão digital, celular, internet, aplicativos, mensagens e segurança contra golpes. Use o histórico da conversa para manter contexto. A biblioteca interna é apoio, não limite. Nunca peça senha, CPF, cartão, código, documento ou dados bancários. Se houver risco, oriente parar e pedir ajuda. Responda SEMPRE em JSON com: respostaSimples, passoAPasso, atencao, quandoPedirAjuda.';
  const payload = {
    model: MODELO_NVIDIA,
    temperature: 0.2,
    max_tokens: 700,
    extra_body: { chat_template_kwargs: { enable_thinking: false } },
    messages: [{ role: 'system', content: system }, { role: 'user', content: `Intenção: ${intencao}\nHistórico recente: ${JSON.stringify(historicoSeguro)}\nPergunta atual: ${pergunta}\nContexto FAQ (apoio): ${JSON.stringify(contextoFaq)}` }]
  };
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

  const intencao = classificarIntencao(pergunta);
  if (intencao === 'saudacao_ou_vaga') return res.status(200).json(pacote(TIPOS_PUBLICOS.saudacao_ou_vaga, respostaPadrao({ respostaSimples: 'Boa! Eu sou o Sérgio. Me diga no que você precisa de ajuda.', passoAPasso: ['Escreva sua dúvida em uma frase simples.', 'Se puder, diga o que apareceu na tela.', 'Eu te explico passo a passo.'], atencao: 'Não compartilhe dados pessoais.', quandoPedirAjuda: 'Se envolver dinheiro ou risco de golpe, peça ajuda.' }), 'local'));
  if (intencao === 'consulta_loja_site_confiavel') return res.status(200).json(pacote(TIPOS_PUBLICOS.consulta_loja_site, respostaPadrao({ respostaSimples: 'Eu ainda não consulto a internet em tempo real.', passoAPasso: ['Confira o endereço do site.', 'Procure CNPJ e contato.', 'Pesquise no Reclame Aqui e no Google.', 'Desconfie de preço muito baixo.', 'Evite Pix se estiver inseguro.', 'Peça ajuda antes de comprar.'] }), 'seguranca'));
  if (intencao.startsWith('seguranca_') || ['documento_dados_pessoais', 'saude'].includes(intencao)) return res.status(200).json(pacote(TIPOS_PUBLICOS.seguranca, respostaSeguranca(intencao), 'seguranca'));

  if (!process.env.NVIDIA_API_KEY) return res.status(200).json(pacote(TIPOS_PUBLICOS.fallback, respostaPadrao({ respostaSimples: 'No momento estou no modo local. Na versão Vercel eu também respondo com IA.', passoAPasso: ['Faça a pergunta com mais detalhes.', 'Posso usar minha biblioteca local para te orientar.'] }), 'local'));

  try {
    const contexto = buscarContextoFaq(pergunta);
    const historicoSeguro = historico.slice(-6).filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && !temDadoPessoal(m.content)).map((m) => ({ role: m.role, content: m.content.slice(0, 280) }));
    const resposta = await chamarNvidia(pergunta, contexto, intencao, historicoSeguro);
    const tipo = intencao === 'duvida_digital' ? TIPOS_PUBLICOS.duvida_digital : TIPOS_PUBLICOS.duvida_geral;
    return res.status(200).json(pacote(tipo, resposta, contexto.length ? 'faq' : 'ia'));
  } catch {
    return res.status(200).json(pacote(TIPOS_PUBLICOS.fallback, respostaPadrao({ respostaSimples: 'Não consegui usar IA agora, mas posso te orientar com segurança.', passoAPasso: ['Explique sua dúvida com outras palavras.', 'Se for sobre aplicativo, diga o nome e o que apareceu.', 'Se houver risco, não envie dados e peça ajuda.'] }), 'local'));
  }
}
