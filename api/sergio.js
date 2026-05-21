import fs from 'fs';
import path from 'path';

const termosSensiveis = [
  'senha', 'cpf', 'cartão', 'cartao', 'código', 'codigo', 'token', 'documento',
  'saúde', 'saude', 'pix', 'banco', 'dinheiro', 'compra', 'golpe', 'link',
  'número desconhecido', 'numero desconhecido'
];

const termosGenericos = new Set(['duvida', 'ajuda', 'celular', 'aplicativo', 'app', 'whatsapp', 'internet', 'coisa', 'mexer', 'ola', 'oi', 'tenho', 'queria', 'perguntar', 'gostaria']);
const termosIntencaoDigital = new Set(['facebook', 'instagram', 'messenger', 'conversar', 'amiga', 'amigo', 'mensagem', 'foto', 'perfil', 'abrir', 'apagar', 'enviar', 'receber', 'camera', 'volume', 'print', 'wifi', 'email', 'app', 'aplicativo', 'celular']);

const MODELO_PADRAO = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
const MODELO_NVIDIA = process.env.NVIDIA_MODEL || MODELO_PADRAO;

function logSeguro(payload) {
  console.log('[sergio]', payload);
}

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

function respostaForaEscopo() {
  return {
    respostaSimples: 'Eu sou melhor para ajudar com celular, internet, aplicativos, mensagens e segurança digital. Sobre receita, peça ajuda a alguém ou use um aplicativo/site de receitas com cuidado.',
    passoAPasso: [
      'Para dúvidas digitais, me diga o aplicativo e o que apareceu na tela.',
      'Se for sobre mensagens, internet ou segurança, eu te ajudo agora.',
      'Se for assunto fora de tecnologia, procure uma pessoa de confiança ou um serviço específico.'
    ],
    atencao: 'Nunca compartilhe senha, código, CPF ou dados do cartão.',
    quandoPedirAjuda: 'Se surgir pedido de dinheiro, link estranho, senha ou dúvida de segurança.'
  };
}

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
    .map((x) => ({ categoria: x.item.categoria, pergunta: x.item.pergunta, respostaSimples: x.item.respostaSimples, passoAPasso: x.item.passoAPasso, atencao: x.item.atencao, quandoPedirAjuda: x.item.quandoPedirAjuda }));
}

function limparMarkdown(texto = '') {
  return texto.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function extrairJsonCandidato(texto = '') {
  const inicio = texto.indexOf('{');
  const fim = texto.lastIndexOf('}');
  if (inicio >= 0 && fim > inicio) return texto.slice(inicio, fim + 1);
  return '';
}

function construirFallbackTextoUtil(texto = '') {
  const frases = texto
    .split(/\n|\.|;|\u2022|\-/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  if (!frases.length) return null;

  const primeiraFrase = frases.find((f) => f.length > 10) || frases[0];
  const passos = frases
    .filter((f) => /passo|abra|toque|clique|depois|em seguida|acesse|envie|escreva/i.test(f) || f.length > 20)
    .slice(0, 5);

  return {
    respostaSimples: primeiraFrase,
    passoAPasso: passos.length ? passos : ['Abra o aplicativo relacionado e procure a opção principal da tarefa.', 'Siga as opções de mensagem ou conversa em etapas curtas.', 'Se tiver dúvida na tela, peça ajuda de alguém de confiança.'],
    atencao: 'Cuidado com links estranhos, pedidos de senha, código, Pix ou dados pessoais.',
    quandoPedirAjuda: 'Peça ajuda se aparecer senha, dinheiro, link estranho ou qualquer dúvida de segurança.'
  };
}

function extrairCampo(texto, rotulo) {
  const rgx = new RegExp(`${rotulo}\\s*:\\s*([\\s\\S]*?)(?=\\n(?:Resposta simples|Passo a passo|Atenção|Atencao|Quando pedir ajuda)\\s*:|$)`, 'i');
  const m = texto.match(rgx);
  return m?.[1]?.trim() || '';
}

function estruturarRespostaIA(rawContent = '') {
  const content = limparMarkdown(rawContent);
  if (!content) return { resposta: null, motivo: 'sem_content' };

  const candidatoJson = extrairJsonCandidato(content) || content;

  try {
    const parsed = JSON.parse(candidatoJson);
    if (parsed?.respostaSimples && Array.isArray(parsed?.passoAPasso) && parsed?.atencao && parsed?.quandoPedirAjuda) {
      return { resposta: parsed, motivo: 'json_ok' };
    }
  } catch (_) {
    logSeguro({ etapa: 'json_falhou' });
  }

  const respostaSimples = extrairCampo(content, 'Resposta simples');
  const passosTexto = extrairCampo(content, 'Passo a passo');
  const atencao = extrairCampo(content, 'Atenção') || extrairCampo(content, 'Atencao');
  const quandoPedirAjuda = extrairCampo(content, 'Quando pedir ajuda');

  if (respostaSimples || passosTexto || atencao || quandoPedirAjuda) {
    const passoAPasso = passosTexto
      .split(/\n|\d+\.|-|•/)
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 5);

    return {
      resposta: {
        respostaSimples: respostaSimples || 'Vamos resolver isso juntos, em passos simples.',
        passoAPasso: passoAPasso.length ? passoAPasso : ['Abra o aplicativo e procure a opção principal da tarefa.', 'Siga as opções da tela com calma.', 'Se algo parecer estranho, pare e peça ajuda.'],
        atencao: atencao || 'Cuidado com links e pedidos de dados pessoais.',
        quandoPedirAjuda: quandoPedirAjuda || 'Peça ajuda se aparecer senha, dinheiro, link estranho ou dúvida.'
      },
      motivo: 'json_falhou'
    };
  }

  const fallbackUtil = construirFallbackTextoUtil(content);
  if (fallbackUtil) return { resposta: fallbackUtil, motivo: 'json_falhou' };

  return { resposta: null, motivo: 'json_falhou' };
}

function perguntaForaEscopo(pergunta = '') {
  const t = normalizarTexto(pergunta);
  return /receita|bolo|cozinhar|cozinha/.test(t);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const { pergunta } = req.body || {};
  if (!pergunta || typeof pergunta !== 'string') return res.status(400).json({ error: 'Pergunta inválida.' });

  logSeguro({ etapa: 'inicio', tamanhoPergunta: pergunta.length });

  if (contemConteudoSensivel(pergunta)) {
    logSeguro({ etapa: 'sensivel', tamanhoPergunta: pergunta.length });
    return res.status(200).json({ seguro: true, resposta: respostaSeguraLocal() });
  }
  if (perguntaVaga(pergunta)) {
    logSeguro({ etapa: 'vaga', tamanhoPergunta: pergunta.length });
    return res.status(200).json({ esclarecimento: true, resposta: respostaEsclarecimento() });
  }
  if (perguntaForaEscopo(pergunta)) {
    return res.status(200).json({ resposta: respostaForaEscopo() });
  }
  if (!process.env.NVIDIA_API_KEY) {
    logSeguro({ etapa: 'fallback', motivo: 'sem_api_key' });
    return res.status(200).json({ fallback: true, motivo: 'sem_api_key' });
  }

  try {
    const contextoFaq = selecionarContextoFaq(carregarFaq(), pergunta);
    logSeguro({ etapa: 'chamando_nvidia', tamanhoPergunta: pergunta.length, modelo: MODELO_NVIDIA });

    const resposta = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODELO_NVIDIA, temperature: 0.15, max_tokens: 800,
        extra_body: { chat_template_kwargs: { enable_thinking: false } },
        messages: [
          { role: 'system', content: 'Você é o Assistente Sérgio da inclusão digital para idosos. Sua função é ajudar em dúvidas digitais gerais: celular, internet, aplicativos, Facebook, Messenger, WhatsApp, segurança digital e mensagens. A biblioteca interna é apenas apoio, não é limite. Mesmo sem FAQ exata, responda com orientação geral segura e prática. Use português simples e acolhedor. Não use markdown. Não exponha raciocínio interno. Responda de preferência em JSON puro no formato: {"respostaSimples":"","passoAPasso":[""],"atencao":"","quandoPedirAjuda":""}. Para pedido como "me ajuda a conversar com minha amiga no facebook", explique passos claros para Facebook/Messenger. Se a tela exata variar, diga o caminho geral mais seguro.' },
          { role: 'user', content: `Pergunta do usuário: ${pergunta}\n\nContexto da biblioteca interna (FAQ): ${JSON.stringify(contextoFaq)}` }
        ]
      })
    });

    logSeguro({ etapa: 'nvidia_status', status: resposta.status });
    if (!resposta.ok) {
      logSeguro({ etapa: 'fallback', motivo: 'nvidia_http_erro', status: resposta.status });
      return res.status(200).json({ fallback: true, motivo: 'nvidia_http_erro' });
    }

    const dados = await resposta.json();
    const content = dados?.choices?.[0]?.message?.content || '';

    logSeguro({ etapa: 'sem_content', existeContent: Boolean(content), tamanhoContent: content.length });
    if (!content) return res.status(200).json({ fallback: true, motivo: 'sem_content' });

    const estruturada = estruturarRespostaIA(content);
    if (!estruturada?.resposta) {
      logSeguro({ etapa: 'fallback', motivo: estruturada?.motivo || 'json_falhou' });
      return res.status(200).json({ fallback: true, motivo: estruturada?.motivo || 'json_falhou' });
    }

    logSeguro({ etapa: estruturada.motivo === 'json_ok' ? 'json_ok' : 'json_falhou', tamanhoContent: content.length });
    return res.status(200).json({ resposta: estruturada.resposta });
  } catch (_) {
    logSeguro({ etapa: 'fallback', motivo: 'erro_execucao' });
    return res.status(200).json({ fallback: true, motivo: 'erro_execucao' });
  }
}
