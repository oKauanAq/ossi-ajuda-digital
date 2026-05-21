const termosSensiveis = [
  'senha', 'cpf', 'cartão', 'cartao', 'código', 'codigo', 'token', 'documento',
  'saúde', 'saude', 'pix', 'banco', 'dinheiro', 'compra', 'golpe',
  'número desconhecido', 'numero desconhecido'
];

function contemConteudoSensivel(texto = '') {
  const t = texto.toLowerCase();
  if (termosSensiveis.some((termo) => t.includes(termo))) return true;
  if (/link\s+suspeito/.test(t)) return true;
  return false;
}

function respostaSeguraLocal() {
  return {
    respostaSimples: 'Vamos com calma. Não faça nenhuma ação agora.',
    passoAPasso: [
      'Não clique em links ou botões suspeitos.',
      'Não informe senha, código, token, CPF ou dados de cartão.',
      'Não faça Pix, compra ou transferência.',
      'Peça ajuda de alguém de confiança ou da equipe da OSSI.'
    ],
    atencao: 'Este sistema não acessa banco, gov.br nem compras.',
    quandoPedirAjuda: 'Sempre que houver dúvida sobre segurança, dinheiro ou possível golpe.'
  };
}

function respostaSeguraGenerica() {
  return {
    respostaSimples: 'Entendi sua dúvida. Vamos tentar de um jeito simples e seguro.',
    passoAPasso: [
      'Abra o aplicativo oficial relacionado à sua dúvida.',
      'Procure a opção de Configurações ou Ajuda.',
      'Siga apenas instruções que aparecem dentro do app oficial.',
      'Se algo parecer estranho, pare e peça ajuda para alguém de confiança.'
    ],
    atencao: 'Nunca compartilhe senha, código de verificação, CPF ou dados bancários.',
    quandoPedirAjuda: 'Peça ajuda se aparecer cobrança, pedido de código ou mensagem suspeita.'
  };
}

function extrairCampo(texto, inicio, fimOpcional) {
  const inicioRegex = new RegExp(`${inicio}\\s*:\\s*([\\s\\S]*?)${fimOpcional ? `(?=\\n${fimOpcional}\\s*:)` : '$'}`, 'i');
  const match = texto.match(inicioRegex);
  return match?.[1]?.trim() || '';
}

function estruturarRespostaIA(texto = '') {
  const textoSemMarkdown = texto
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    const parsed = JSON.parse(textoSemMarkdown);
    const resposta = {
      respostaSimples: String(parsed?.respostaSimples || '').trim(),
      passoAPasso: Array.isArray(parsed?.passoAPasso) ? parsed.passoAPasso.map((p) => String(p).trim()).filter(Boolean) : [],
      atencao: String(parsed?.atencao || '').trim(),
      quandoPedirAjuda: String(parsed?.quandoPedirAjuda || '').trim()
    };
    if (resposta.respostaSimples && resposta.passoAPasso.length && resposta.atencao && resposta.quandoPedirAjuda) {
      return resposta;
    }
  } catch (_) {
    // fallback por extração textual abaixo
  }

  const respostaSimples = extrairCampo(texto, 'Resposta simples', 'Passo a passo');
  const blocoPassos = extrairCampo(texto, 'Passo a passo', 'Atenção');
  const atencao = extrairCampo(texto, 'Atenção', 'Quando pedir ajuda');
  const quandoPedirAjuda = extrairCampo(texto, 'Quando pedir ajuda');

  const passoAPasso = blocoPassos
    .split('\n')
    .map((linha) => linha.replace(/^[-\d.)\s]+/, '').trim())
    .filter(Boolean);

  if (!respostaSimples || !passoAPasso.length || !atencao || !quandoPedirAjuda) {
    return null;
  }

  return { respostaSimples, passoAPasso, atencao, quandoPedirAjuda };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { pergunta } = req.body || {};
  if (!pergunta || typeof pergunta !== 'string') {
    return res.status(400).json({ error: 'Pergunta inválida.' });
  }

  if (contemConteudoSensivel(pergunta)) {
    return res.status(200).json({ seguro: true, resposta: respostaSeguraLocal() });
  }

  if (!process.env.NVIDIA_API_KEY) {
    return res.status(503).json({ error: 'Modo IA indisponível.' });
  }

  try {
    const resposta = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
        temperature: 0.2,
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content: `Você é o assistente Sérgio para idosos. Responda em português claro e simples.
Responda apenas com JSON válido. Não use markdown. Não escreva texto fora do JSON.
Use exatamente este formato:
{
  "respostaSimples": "texto curto",
  "passoAPasso": ["passo 1", "passo 2", "passo 3"],
  "atencao": "alerta curto",
  "quandoPedirAjuda": "quando pedir ajuda"
}
No campo passoAPasso, escreva de 3 a 5 passos curtos.`
          },
          { role: 'user', content: pergunta }
        ]
      })
    });

    if (!resposta.ok) {
      return res.status(200).json({ fallback: true });
    }

    const dados = await resposta.json();
    const texto = dados?.choices?.[0]?.message?.content?.trim();
    const estruturada = estruturarRespostaIA(texto || '');

    if (!estruturada) return res.status(200).json({ resposta: respostaSeguraGenerica(), fallback: true });

    return res.status(200).json({ resposta: estruturada });
  } catch (_) {
    return res.status(200).json({ fallback: true });
  }
}
