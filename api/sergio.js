import fs from 'fs';
import path from 'path';

const termosSensiveis = [
  'senha', 'cpf', 'cartão', 'cartao', 'código', 'codigo', 'token', 'documento',
  'saúde', 'saude', 'pix', 'banco', 'dinheiro', 'compra', 'golpe', 'link',
  'número desconhecido', 'numero desconhecido'
];

const termosGenericos = new Set(['duvida', 'ajuda', 'celular', 'aplicativo', 'app', 'whatsapp', 'internet', 'coisa', 'mexer', 'ola', 'oi', 'tenho', 'queria', 'perguntar', 'gostaria']);
const termosIntencaoDigital = new Set(['facebook', 'instagram', 'messenger', 'conversar', 'amiga', 'amigo', 'mensagem', 'foto', 'perfil', 'abrir', 'apagar', 'enviar', 'receber', 'camera', 'volume', 'print', 'wifi', 'email', 'app', 'aplicativo', 'celular']);

function normalizarTexto(texto = '') {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function contemConteudoSensivel(texto = '') {
  const t = normalizarTexto(texto);
  return termosSensiveis.some((termo) => t.includes(normalizarTexto(termo)));
}

function perguntaVaga(texto = '') {
  const t = normalizarTexto(texto);
  if (!t || t.length < 6) return true;

  if (['oi', 'ola', 'me ajuda', 'ajuda', 'tenho uma duvida', 'nao sei mexer', 'queria perguntar uma coisa', 'ola gostaria de tirar uma duvida'].includes(t)) return true;

  const semFrasesGenericas = t
    .replace(/\b(me ajuda|tenho uma duvida|tenho duvida|duvida|nao sei mexer|queria perguntar uma coisa|gostaria de tirar uma duvida)\b/g, ' ')
    .trim();

  const tokens = semFrasesGenericas.split(/\s+/).map((tok) => tok.replace(/[^\p{L}\p{N}-]/gu, '')).filter(Boolean);
  const especificos = tokens.filter((tok) => tok.length > 2 && !termosGenericos.has(tok));
  if (especificos.some((tok) => termosIntencaoDigital.has(tok))) return false;
  return especificos.length === 0;
}

function respostaSeguraLocal() { return { respostaSimples: 'Vamos com calma. Não faça nenhuma ação agora.', passoAPasso: ['Não clique em links ou botões suspeitos.', 'Não informe senha, código, token, CPF ou dados de cartão.', 'Não faça Pix, compra ou transferência.', 'Peça ajuda de alguém de confiança ou da equipe da OSSI.'], atencao: 'Este sistema não acessa banco, gov.br nem compras.', quandoPedirAjuda: 'Sempre que houver dúvida sobre segurança, dinheiro ou possível golpe.' }; }
function respostaEsclarecimento() { return { respostaSimples: 'Claro. Me diga qual é a sua dúvida sobre celular, WhatsApp, internet, compras, banco, golpes ou aplicativos.', passoAPasso: ['Escreva o que aconteceu em uma frase.', 'Diga qual aplicativo você estava usando.', 'Se apareceu aviso, copie o texto do aviso.'], atencao: 'Nunca compartilhe senha, código, CPF ou dados do cartão.', quandoPedirAjuda: 'Se houver pedido de dinheiro, link suspeito ou medo de golpe.' }; }

function carregarFaq() {
  const faqPath = path.join(process.cwd(), 'data', 'faq.json');
  return JSON.parse(fs.readFileSync(faqPath, 'utf8'));
}

function pontuar(item, pergunta) {
  const q = normalizarTexto(pergunta);
  const termos = q.split(/\s+/).map((t) => t.replace(/[^\p{L}\p{N}]/gu, '')).filter((t) => t.length > 2 && !termosGenericos.has(t));
  if (!termos.length) return -10;
  const texto = normalizarTexto(`${item.categoria} ${item.pergunta} ${(item.palavrasChave || []).join(' ')}`);
  return termos.reduce((acc, termo) => acc + (texto.includes(termo) ? 3 : 0), 0);
}

function selecionarContextoFaq(faq, pergunta) {
  return faq
    .map((item) => ({ item, score: pontuar(item, pergunta) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .slice(0, Math.max(3, Math.min(6, faq.length)))
    .map((x) => ({ categoria: x.item.categoria, pergunta: x.item.pergunta, respostaSimples: x.item.respostaSimples, passoAPasso: x.item.passoAPasso, atencao: x.item.atencao, quandoPedirAjuda: x.item.quandoPedirAjuda }));
}

function estruturarRespostaIA(texto = '') { try { const parsed = JSON.parse(texto.replace(/```json/gi, '').replace(/```/g, '').trim()); if (parsed?.respostaSimples && Array.isArray(parsed?.passoAPasso) && parsed?.atencao && parsed?.quandoPedirAjuda) return parsed; } catch (_) {} return null; }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const { pergunta } = req.body || {};
  if (!pergunta || typeof pergunta !== 'string') return res.status(400).json({ error: 'Pergunta inválida.' });

  if (contemConteudoSensivel(pergunta)) return res.status(200).json({ seguro: true, resposta: respostaSeguraLocal() });
  if (perguntaVaga(pergunta)) return res.status(200).json({ esclarecimento: true, resposta: respostaEsclarecimento() });
  if (!process.env.NVIDIA_API_KEY) return res.status(200).json({ fallback: true });

  try {
    const contextoFaq = selecionarContextoFaq(carregarFaq(), pergunta);
    const resposta = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', temperature: 0.2, max_tokens: 600,
        extra_body: { chat_template_kwargs: { enable_thinking: false } },
        messages: [
          { role: 'system', content: 'Você é o assistente Sérgio para idosos. Linguagem simples, curta e acolhedora. Responda como assistente de inclusão digital para idosos. A biblioteca é apoio, mas você pode responder dúvidas digitais gerais de forma segura mesmo se não houver item exato na biblioteca. Nunca peça senha, CPF, cartão, código, documento ou dados de saúde. Responda APENAS com JSON válido no formato: {"respostaSimples":"","passoAPasso":[""],"atencao":"","quandoPedirAjuda":""}.' },
          { role: 'user', content: `Pergunta do usuário: ${pergunta}\n\nContexto da biblioteca interna (FAQ): ${JSON.stringify(contextoFaq)}` }
        ]
      })
    });
    if (!resposta.ok) return res.status(200).json({ fallback: true });
    const dados = await resposta.json();
    const estruturada = estruturarRespostaIA(dados?.choices?.[0]?.message?.content || '');
    if (!estruturada) return res.status(200).json({ fallback: true });
    return res.status(200).json({ resposta: estruturada });
  } catch (_) { return res.status(200).json({ fallback: true }); }
}
