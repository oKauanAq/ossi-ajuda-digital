import fs from 'fs';
import path from 'path';

const MODELO_PADRAO = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
const MODELO_NVIDIA = process.env.NVIDIA_MODEL || MODELO_PADRAO;

const categoriasSeguranca = [
  { nome: 'senha_recuperacao', termos: ['senha', 'esqueci senha', 'recuperar conta', 'recuperacao', 'email'] },
  { nome: 'codigo_token', termos: ['codigo', 'código', 'token', 'sms'] },
  { nome: 'pix_banco_dinheiro', termos: ['pix', 'banco', 'dinheiro', 'transferencia', 'transferência'] },
  { nome: 'numero_desconhecido', termos: ['numero desconhecido', 'número desconhecido', 'perfil falso', 'foto do meu', 'se passando'] },
  { nome: 'link_suspeito', termos: ['link', 'site estranho', 'cliquei'] },
  { nome: 'loja_site_confiavel', termos: ['loja', 'site confiavel', 'site confiável', 'compra online'] },
  { nome: 'documentos', termos: ['cpf', 'cartao', 'cartão', 'documento'] },
  { nome: 'saude', termos: ['saude', 'saúde', 'remedio', 'remédio'] }
];

function normalizarTexto(texto = '') {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function detectarCategoriaSeguranca(pergunta = '') {
  const t = normalizarTexto(pergunta);
  return categoriasSeguranca.find((c) => c.termos.some((termo) => t.includes(normalizarTexto(termo))))?.nome || null;
}

function respostaSegurancaPorCategoria(categoria) {
  const base = {
    atencao: 'Nunca informe senha, CPF, cartão, código ou dados bancários.',
    quandoPedirAjuda: 'Peça ajuda a familiar de confiança ou à equipe da OSSI se houver risco, dinheiro ou dúvida.'
  };

  const respostas = {
    senha_recuperacao: {
      respostaSimples: 'Você pode recuperar a conta com segurança.',
      passoAPasso: ['Use o botão "Esqueci minha senha" no app ou site oficial.', 'Use apenas canais oficiais, não links enviados por terceiros.', 'Não compartilhe código recebido por SMS, WhatsApp ou e-mail.', 'Se pedirem pagamento para recuperar conta, pare e peça ajuda.']
    },
    codigo_token: {
      respostaSimples: 'Código de verificação é secreto.',
      passoAPasso: ['Nunca passe código/token para outra pessoa.', 'Digite o código só no app oficial que você abriu.', 'Se recebeu código sem pedir, troque a senha da conta.', 'Ative verificação em duas etapas quando possível.']
    },
    pix_banco_dinheiro: {
      respostaSimples: 'Com pedido de dinheiro, pare e confirme antes.',
      passoAPasso: ['Não faça Pix na pressa.', 'Confirme por ligação para número já salvo.', 'Desconfie de urgência, ameaça ou pressão.', 'Se suspeitar de golpe, bloqueie e denuncie o contato.']
    },
    numero_desconhecido: {
      respostaSimples: 'Não confie só na foto do perfil.',
      passoAPasso: ['Ligue para a pessoa no número antigo já salvo.', 'Não envie dinheiro, código ou documento.', 'Se parecer golpe, bloqueie e denuncie.', 'Peça ajuda a familiar ou equipe OSSI antes de agir.']
    },
    link_suspeito: {
      respostaSimples: 'Link suspeito pode ser golpe.',
      passoAPasso: ['Não clique no link.', 'Se já clicou, não faça login nem informe dados.', 'Feche a página e abra o app oficial manualmente.', 'Troque senha se digitou dados.']
    },
    loja_site_confiavel: {
      respostaSimples: 'Ainda não consulto internet em tempo real para validar lojas.',
      passoAPasso: ['Confira o endereço completo do site.', 'Procure CNPJ e canais de atendimento.', 'Pesquise avaliações no Reclame Aqui e Google.', 'Evite Pix se tiver dúvida e desconfie de preço bom demais.', 'Peça ajuda antes de comprar.']
    },
    documentos: {
      respostaSimples: 'Proteja seus documentos e dados.',
      passoAPasso: ['Não envie CPF/cartão em conversa de desconhecido.', 'Compartilhe dados só em canais oficiais confiáveis.', 'Se houver pressão para enviar, pare imediatamente.', 'Peça ajuda antes de confirmar qualquer envio.']
    },
    saude: {
      respostaSimples: 'Posso orientar de forma geral, mas saúde exige cuidado profissional.',
      passoAPasso: ['Para sintomas fortes, procure atendimento médico.', 'Não use remédio sem orientação.', 'Confirme informações de saúde com profissional.', 'Em emergência, ligue para serviço de urgência local.']
    }
  };

  return { ...base, ...(respostas[categoria] || respostas.link_suspeito) };
}

function carregarFaq() { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'faq.json'), 'utf8')); }

function selecionarContextoFaq(faq, pergunta) {
  const q = normalizarTexto(pergunta);
  return faq.filter((item) => normalizarTexto(`${item.categoria} ${item.pergunta} ${(item.palavrasChave || []).join(' ')}`).includes(q.split(' ')[0] || ''))
    .slice(0, 6)
    .map((x) => ({ categoria: x.categoria, pergunta: x.pergunta, respostaSimples: x.respostaSimples, passoAPasso: x.passoAPasso, atencao: x.atencao, quandoPedirAjuda: x.quandoPedirAjuda }));
}

function estruturarRespostaIA(raw = '') {
  const content = String(raw).replace(/```json/gi, '').replace(/```/g, '').trim();
  const cands = [content];
  const i = content.indexOf('{'); const f = content.lastIndexOf('}');
  if (i >= 0 && f > i) cands.unshift(content.slice(i, f + 1));

  for (const cand of cands) {
    try {
      const parsed = JSON.parse(cand);
      if (parsed?.respostaSimples) {
        return {
          respostaSimples: String(parsed.respostaSimples),
          passoAPasso: Array.isArray(parsed.passoAPasso) ? parsed.passoAPasso.map(String).slice(0, 6) : [],
          atencao: String(parsed.atencao || 'Cuidado com dados pessoais.'),
          quandoPedirAjuda: String(parsed.quandoPedirAjuda || 'Peça ajuda se tiver dúvida de segurança.')
        };
      }
    } catch {}
  }

  return {
    respostaSimples: content.replace(/[{}\[\]"]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240) || 'Vamos resolver isso com calma.',
    passoAPasso: ['Abra o aplicativo oficial.', 'Siga os passos com calma.', 'Se houver risco de golpe, pare e peça ajuda.'],
    atencao: 'Não compartilhe senha, código, CPF, cartão ou dados bancários.',
    quandoPedirAjuda: 'Se houver pedido de dinheiro, link estranho ou dúvida de segurança.'
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const { pergunta } = req.body || {};
  if (!pergunta || typeof pergunta !== 'string') return res.status(400).json({ error: 'Pergunta inválida.' });

  const categoria = detectarCategoriaSeguranca(pergunta);
  if (categoria) return res.status(200).json({ resposta: respostaSegurancaPorCategoria(categoria) });

  if (!process.env.NVIDIA_API_KEY) return res.status(200).json({ fallback: true, motivo: 'sem_api_key' });

  try {
    const contextoFaq = selecionarContextoFaq(carregarFaq(), pergunta);
    const resposta = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODELO_NVIDIA, temperature: 0.2, max_tokens: 800,
        extra_body: { chat_template_kwargs: { enable_thinking: false } },
        messages: [
          { role: 'system', content: 'Você é Sérgio, uma IA assistente acolhedora para idosos da OSSI. Responda dúvidas do dia a dia com linguagem simples. Sua especialidade é inclusão digital, celular, internet, aplicativos, mensagens e segurança contra golpes. A biblioteca interna é apoio, não limite. Nunca peça senha, CPF, cartão, código, documento ou dados bancários. Para riscos, oriente parar, verificar e pedir ajuda. Responda SEMPRE no formato JSON: {"respostaSimples":"","passoAPasso":[],"atencao":"","quandoPedirAjuda":""}.' },
          { role: 'user', content: `Pergunta: ${pergunta}

Contexto FAQ: ${JSON.stringify(contextoFaq)}` }
        ]
      })
    });
    if (!resposta.ok) return res.status(200).json({ fallback: true, motivo: 'nvidia_http_erro' });
    const dados = await resposta.json();
    const content = dados?.choices?.[0]?.message?.content || '';
    if (!content) return res.status(200).json({ fallback: true, motivo: 'sem_content' });
    return res.status(200).json({ resposta: estruturarRespostaIA(content) });
  } catch {
    return res.status(200).json({ fallback: true, motivo: 'erro_execucao' });
  }
}
