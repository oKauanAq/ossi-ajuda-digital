export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { pergunta } = req.body || {};
  if (!pergunta || typeof pergunta !== 'string') {
    return res.status(400).json({ error: 'Pergunta inválida.' });
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
        max_tokens: 250,
        messages: [
          {
            role: 'system',
            content: 'Você é o assistente Sérgio para idosos. Responda em português claro, com passos simples e curtos. Não peça dados pessoais e não incentive ações de risco.'
          },
          { role: 'user', content: pergunta }
        ]
      })
    });

    if (!resposta.ok) {
      return res.status(502).json({ error: 'Falha na resposta da NVIDIA.' });
    }

    const dados = await resposta.json();
    const texto = dados?.choices?.[0]?.message?.content?.trim();

    if (!texto) {
      return res.status(502).json({ error: 'Resposta vazia da IA.' });
    }

    return res.status(200).json({ resposta: texto });
  } catch (erro) {
    return res.status(500).json({ error: 'Erro interno ao consultar IA.' });
  }
}
