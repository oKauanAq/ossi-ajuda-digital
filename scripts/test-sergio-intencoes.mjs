import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler, {
  GUIAS_LOCAIS,
  PACOTES_ORIENTACAO,
  classificarRotaPrincipal,
  contemRiscoReal,
  detectarContinuidadeDeEscolha,
  detectarIntencao,
  montarPacoteIA,
  normalizarTexto,
  validarRespostaIA
} from '../api/sergio.js';


process.env.NVIDIA_API_KEY = 'chave-de-teste-sem-rede';
const fetchOriginal = globalThis.fetch;
let chamadasIA = 0;
globalThis.fetch = async (_url, options = {}) => {
  chamadasIA += 1;
  const pacote = JSON.parse(JSON.parse(options.body).messages[1].content);
  const pergunta = normalizarTexto(pacote.perguntaAtual);
  let resposta;
  if (/volume/.test(pergunta) && /android/.test(pergunta)) {
    resposta = { respostaSimples: 'No Android, use os botões laterais de volume e confira o controle de mídia na tela.', passoAPasso: ['Aperte o botão de aumentar volume na lateral do celular.', 'Veja se aparece volume de mídia, chamada ou toque.', 'Arraste a barra para a direita.', 'Se não ouvir, confira se o celular não está no silencioso.'], atencao: '', quandoPedirAjuda: '', alertaHumano: '', opcoesFluxo: [] };
  } else if (/apagar/.test(pergunta) && /iphone/.test(pergunta)) {
    resposta = { respostaSimples: 'No iPhone, apague aplicativos pela tela inicial ou pela Biblioteca de Apps.', passoAPasso: ['Toque e segure o ícone do aplicativo.', 'Toque em Remover App.', 'Escolha Apagar App.', 'Confirme somente se tiver certeza.'], atencao: 'Evite apagar apps de banco ou serviços importantes sem ajuda.', quandoPedirAjuda: '', alertaHumano: '', opcoesFluxo: [] };
  } else if (pacote.rotaPrincipal === 'risco_real' || pacote.rotaPrincipal === 'continuidade') {
    resposta = { respostaSimples: 'Pare e confirme essa situação antes de continuar, pois pode ser golpe.', passoAPasso: ['Não envie dinheiro nem dados.', 'Confirme por um número antigo ou canal oficial.', 'Fale com alguém de confiança antes de agir.'], atencao: 'Golpistas usam pressa e mensagens assustadoras.', quandoPedirAjuda: 'Peça ajuda antes de pagar ou clicar.', alertaHumano: '⚠️ Essa situação é arriscada. Antes de enviar dinheiro, senha ou código, fale pessoalmente com um familiar de confiança ou peça ajuda na Obra Social Santa Isabel.', opcoesFluxo: [] };
  } else if (/facebook/.test(pergunta) && /abrir|aplicativo|app/.test(pergunta)) {
    resposta = { respostaSimples: 'Para abrir o Facebook, procure o ícone azul com a letra F e toque nele.', passoAPasso: ['Olhe na tela inicial do celular.', 'Toque no ícone do Facebook.', 'Se não encontrar, use a busca do celular e digite Facebook.'], atencao: 'Use o aplicativo oficial.', quandoPedirAjuda: '', alertaHumano: '', opcoesFluxo: [] };
  } else if (/instagram/.test(pergunta) && /abrir|aplicativo|app/.test(pergunta)) {
    resposta = { respostaSimples: 'Para abrir o Instagram, procure o ícone colorido do Instagram e toque nele.', passoAPasso: ['Olhe na tela inicial do celular.', 'Toque no ícone do Instagram.', 'Se não encontrar, use a busca do celular.'], atencao: 'Use o aplicativo oficial.', quandoPedirAjuda: '', alertaHumano: '', opcoesFluxo: [] };
  } else if (/volume/.test(pergunta)) {
    resposta = { respostaSimples: 'Para aumentar o volume do celular, use os botões laterais e veja a barra subir na tela.', passoAPasso: ['Aperte o botão de aumentar volume na lateral.', 'Confira a barra de volume na tela.', 'Se não ouvir, veja se o celular está no silencioso.'], atencao: '', quandoPedirAjuda: '', alertaHumano: '', opcoesFluxo: [] };
  } else if (/whatsapp/.test(pergunta) && /ligando|ligacao|chamada|atender/.test(pergunta)) {
    resposta = { respostaSimples: 'Se estão te ligando no WhatsApp, atenda só se conhecer a pessoa. Se for desconhecido ou pedir dinheiro, código, senha, CPF, banco ou documento, desligue.', passoAPasso: ['Se conhecer a pessoa, pode atender.', 'Se for desconhecido, tenha cuidado.', 'Não passe senha, código, CPF, banco nem documento.', 'Se pedir dinheiro, desligue e confirme por outro caminho.', 'Se insistir, bloqueie o contato.'], atencao: 'Golpistas podem fingir ser conhecidos.', quandoPedirAjuda: 'Peça ajuda se houver pedido de dinheiro ou dados.', alertaHumano: '', opcoesFluxo: [] };
  } else if (/facebook/.test(pergunta) && /foto|perfil/.test(pergunta)) {
    resposta = { respostaSimples: 'Para mudar a foto de perfil no Facebook, abra seu perfil e toque na foto.', passoAPasso: ['Abra o Facebook.', 'Entre no seu perfil.', 'Toque na foto de perfil.', 'Escolha uma foto e salve.'], atencao: 'Não passe senha ou código para outra pessoa.', quandoPedirAjuda: '', alertaHumano: '', opcoesFluxo: [] };
  } else if (/whatsapp/.test(pergunta) && /foto|perfil/.test(pergunta)) {
    resposta = { respostaSimples: 'Para mudar a foto de perfil no WhatsApp, abra as configurações e toque na sua foto.', passoAPasso: ['Abra o WhatsApp.', 'Toque em Configurações ou nos três pontinhos.', 'Toque no seu nome ou foto.', 'Escolha uma foto e confirme.'], atencao: 'Use apenas o WhatsApp oficial.', quandoPedirAjuda: '', alertaHumano: '', opcoesFluxo: [] };
  } else if (pacote.rotaPrincipal === 'duvida_digital') {
    resposta = { respostaSimples: 'Vou orientar essa dúvida digital com passos simples.', passoAPasso: ['Abra o aplicativo ou configuração indicada.', 'Procure a opção ligada à sua dúvida.', 'Confira a tela antes de confirmar.', 'Se aparecer senha, código, Pix ou link estranho, pare e peça ajuda.'], atencao: 'Use apenas aplicativos oficiais.', quandoPedirAjuda: '', alertaHumano: '', opcoesFluxo: [] };
  } else if (/mark zuckerberg/.test(pergunta)) {
    resposta = { respostaSimples: 'Mark Zuckerberg é conhecido por cofundar o Facebook e liderar a Meta.', passoAPasso: [], atencao: '', quandoPedirAjuda: '', alertaHumano: '', opcoesFluxo: [] };
  } else if (/internet/.test(pergunta)) {
    resposta = { respostaSimples: 'Internet é uma rede que conecta celulares, computadores, sites e aplicativos.', passoAPasso: ['Ela pode funcionar pelo Wi-Fi ou dados móveis.'], atencao: '', quandoPedirAjuda: '', alertaHumano: '', opcoesFluxo: [] };
  } else if (/sistema|autor|quem fez/.test(pergunta)) {
    resposta = { respostaSimples: 'Este sistema é o OSSI Ajuda Digital da Obra Social Santa Isabel; não devo inventar autoria não informada.', passoAPasso: [], atencao: '', quandoPedirAjuda: '', alertaHumano: '', opcoesFluxo: [] };
  } else {
    resposta = { respostaSimples: 'Aqui vai uma explicação simples e direta sobre esse assunto.', passoAPasso: [], atencao: '', quandoPedirAjuda: '', alertaHumano: '', opcoesFluxo: [] };
  }
  return { ok: true, async json() { return { choices: [{ message: { content: JSON.stringify(resposta) } }] }; } };
};

function criarReq(pergunta, historico = []) {
  return { method: 'POST', body: { pergunta, historico } };
}

function criarRes() {
  return {
    statusCode: 0,
    headers: {},
    payload: null,
    setHeader(nome, valor) { this.headers[nome.toLowerCase()] = valor; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

async function chamar(pergunta, historico = []) {
  const res = criarRes();
  await handler(criarReq(pergunta, historico), res);
  assert.equal(res.statusCode, 200, `status de "${pergunta}"`);
  assert.match(res.headers['cache-control'], /no-store/i, `no-store em /api/sergio para "${pergunta}"`);
  assert.ok(res.payload?.resposta?.respostaSimples, `resposta simples de "${pergunta}"`);
  return res.payload;
}

function textoResposta(payload) {
  return [
    payload.tipo,
    payload.origem,
    payload.resposta?.respostaSimples,
    ...(payload.resposta?.passoAPasso || []),
    payload.resposta?.atencao,
    payload.resposta?.alertaHumano,
    payload.resposta?.quandoPedirAjuda,
    ...(payload.resposta?.opcoesFluxo || [])
  ].filter(Boolean).join(' | ').toLowerCase();
}

function assertSemJsonCru(payload, pergunta) {
  const texto = textoResposta(payload);
  assert.ok(!texto.includes('{') && !texto.includes('}'), `sem JSON cru em "${pergunta}"`);
  assert.ok(!/respostasimples|passoapasso|quandopedirajuda/.test(texto), `sem campos técnicos em "${pergunta}"`);
}

assert.ok(PACOTES_ORIENTACAO.tecnologia, 'há pacote de orientação digital');
assert.ok(PACOTES_ORIENTACAO.risco_real, 'há pacote de orientação de risco');
assert.equal(PACOTES_ORIENTACAO, GUIAS_LOCAIS, 'PACOTES_ORIENTACAO expõe os guias locais');

// A) Pergunta completa ignora histórico de risco.
{
  const historico = [
    { role: 'user', content: 'Estão me ligando pedindo dinheiro' },
    { role: 'assistant', content: 'Isso pode ser golpe. Não envie dinheiro.' }
  ];
  const payload = await chamar('como abrir o facebook', historico);
  assert.equal(classificarRotaPrincipal('como abrir o facebook', historico), 'duvida_digital');
  assert.equal(payload.tipo, 'duvida_digital');
  assert.notEqual(payload.tipo, 'seguranca');
  assert.doesNotMatch(textoResposta(payload), /golpe|dinheiro/i);
}

// A) Perguntas digitais comuns usam rota/guia digital e não viram resposta local rígida de segurança.
for (const pergunta of [
  'Como mudar a foto de perfil no Facebook?',
  'Como mudar a foto de perfil no Instagram?',
  'Como eu apago o aplicativo?',
  'Como abrir o Facebook?',
  'Como atualizar o computador?',
  'Me faça uma lista de exercícios para treinar o uso de celular.',
  'Como mudar a foto de perfil no WhatsApp?'
]) {
  const payload = await chamar(pergunta);
  assert.equal(classificarRotaPrincipal(pergunta), 'duvida_digital', `rota digital em "${pergunta}"`);
  assert.equal(detectarIntencao(pergunta)?.id, 'guia_tecnologia', `intenção genérica de tecnologia em "${pergunta}"`);
  assert.equal(payload.tipo, 'duvida_digital', `tipo digital em "${pergunta}"`);
  assert.match(payload.origem, /ia_orientada|fallback_local_orientado/, `origem IA-first/fallback orientado em "${pergunta}"`);
  assert.doesNotMatch(textoResposta(payload), /essa situação é arriscada|não envie dinheiro|mensagem pedindo dinheiro pode ser golpe/i, `sem bloco de golpe em "${pergunta}"`);
  assert.ok(payload.resposta.passoAPasso.length >= 2, `passos úteis em "${pergunta}"`);
  assertSemJsonCru(payload, pergunta);
}


// A) IA/fallback não genérico para digitais comuns pedidos no fluxo IA-first.
{
  const digitais = [
    ['como abrir aplicativo facebook', /facebook|ícone|icone|letra f|busca/i],
    ['como aumentar volume celular', /volume|botões|botoes|lateral|barra/i],
    ['como mudar foto de perfil no Facebook', /facebook|perfil|foto/i],
    ['estão me ligando no WhatsApp', /whatsapp|conhecer|desconhecido|senha|código|codigo|cpf|bloque/i]
  ];
  for (const [pergunta, esperado] of digitais) {
    const antes = chamadasIA;
    const payload = await chamar(pergunta);
    assert.equal(payload.tipo, 'duvida_digital', `tipo digital em "${pergunta}"`);
    assert.equal(payload.origem, 'ia_orientada', `IA chamada antes do fallback em "${pergunta}"`);
    assert.ok(chamadasIA > antes, `fetch IA chamado em "${pergunta}"`);
    assert.match(textoResposta(payload), esperado, `resposta específica em "${pergunta}"`);
    assert.doesNotMatch(textoResposta(payload), /posso ajudar com essa dúvida digital|diga se você usa android|diga se voce usa android/i, `sem fallback genérico em "${pergunta}"`);
  }
}

// B) Continuidade de aplicativo transforma "e o instagram" em pergunta efetiva completa.
{
  const historico = [
    { role: 'user', content: 'como abrir aplicativo facebook' },
    { role: 'assistant', content: 'Procure o ícone azul do Facebook com a letra F e toque nele.' }
  ];
  const continuidade = detectarContinuidadeDeEscolha('e o instagram', historico);
  assert.equal(continuidade?.perguntaExpandida, 'Como abrir o aplicativo Instagram?');
  const antigoDebug = process.env.SERGIO_DEBUG;
  process.env.SERGIO_DEBUG = 'true';
  const payload = await chamar('e o instagram', historico);
  assert.equal(payload.debugSeguro?.perguntaEfetiva, 'Como abrir o aplicativo Instagram?');
  assert.equal(payload.tipo, 'duvida_digital');
  assert.match(textoResposta(payload), /instagram|ícone|icone|busca/i);
  assert.doesNotMatch(textoResposta(payload), /posso ajudar com essa dúvida digital|diga se você usa android|diga se voce usa android/i);
  if (antigoDebug === undefined) delete process.env.SERGIO_DEBUG; else process.env.SERGIO_DEBUG = antigoDebug;
}

// C) Ligação no WhatsApp com erro de digitação recebe orientação prática, não institucional.
{
  const payload = await chamar('estam me ligando no whatsaapp');
  assert.equal(classificarRotaPrincipal('estam me ligando no whatsaapp'), 'duvida_digital');
  assert.equal(payload.tipo, 'duvida_digital');
  assert.match(textoResposta(payload), /conhecer|desconhecido|senha|código|codigo|cpf|banco|documento|dinheiro|bloque/i);
  assert.doesNotMatch(textoResposta(payload), /não devo inventar|obra social santa isabel; não devo inventar|ossi ajuda digital/i);
}

// A) Quando a IA está indisponível, o fallback digital continua específico por palavra-chave.
{
  const chave = process.env.NVIDIA_API_KEY;
  delete process.env.NVIDIA_API_KEY;
  const antes = chamadasIA;
  const payload = await chamar('como abrir aplicativo facebook');
  assert.equal(payload.origem, 'fallback_local_orientado');
  assert.equal(chamadasIA, antes, 'sem chamada de rede quando não há NVIDIA_API_KEY');
  assert.match(textoResposta(payload), /facebook|ícone|icone|letra f|busca/i);
  assert.doesNotMatch(textoResposta(payload), /posso ajudar com essa dúvida digital|diga se você usa android|diga se voce usa android/i);
  process.env.NVIDIA_API_KEY = chave;
}

// B) Pix seguro é útil e orientado por guia, sem cair em fallback genérico.
{
  const payload = await chamar('Como eu faço um Pix com segurança?');
  assert.equal(classificarRotaPrincipal('Como eu faço um Pix com segurança?'), 'duvida_digital');
  assert.equal(payload.tipo, 'seguranca');
  assert.match(textoResposta(payload), /aplicativo oficial|confira|nome|valor|banco|comprovante/i);
  assert.doesNotMatch(textoResposta(payload), /não consegui entender|tente novamente/i);
}

// C) Risco real mantém alerta humano e não recomenda pagamento.
for (const pergunta of [
  'Me mandaram mensagem pedindo dinheiro.',
  'Estão me ligando por vários números diferentes pedindo dinheiro.',
  'Uma pessoa com foto do meu filho está pedindo dinheiro.',
  'Como saber se a chamada é golpe?',
  'Recebi um link estranho.',
  'Vou mandar Pix para desconhecido.',
  'vou fazer Pix para desconhecido'
]) {
  const payload = await chamar(pergunta);
  assert.equal(classificarRotaPrincipal(pergunta), 'risco_real', `rota risco real em "${pergunta}"`);
  assert.equal(payload.tipo, 'seguranca', `tipo segurança em "${pergunta}"`);
  assert.ok(payload.resposta.alertaHumano, `alerta humano em "${pergunta}"`);
  assert.match(textoResposta(payload), /não faça pagamento|não envie|confirme|número antigo|numero antigo|familiar|obra social santa isabel/i, `orientação segura em "${pergunta}"`);
  assert.doesNotMatch(textoResposta(payload), /faça o pix|envie o dinheiro|confirme o pagamento/i, `não recomenda pagamento em "${pergunta}"`);
}

// D) Dados sensíveis geram bloqueio local imediato, sem IA.
for (const pergunta of ['Minha senha é 123456', 'Meu CPF é 12345678900']) {
  const payload = await chamar(pergunta);
  assert.equal(classificarRotaPrincipal(pergunta), 'dado_sensivel');
  assert.equal(payload.tipo, 'seguranca');
  assert.equal(payload.origem, 'bloqueio_local');
  assert.match(textoResposta(payload), /não compartilhe senha|cpf completo|cartão|documento|apague/i);
}

// E) Perguntas gerais ficam gerais ou institucionais honestas.
for (const [pergunta, esperado] of [
  ['Quem é Mark Zuckerberg?', /facebook|meta/i],
  ['O que é internet?', /rede|conecta|wi/i],
  ['Quem fez esse sistema?', /ossi ajuda digital|obra social santa isabel|não devo inventar/i]
]) {
  const payload = await chamar(pergunta);
  assert.equal(classificarRotaPrincipal(pergunta), 'duvida_geral');
  assert.equal(payload.tipo, 'duvida_geral');
  assert.match(textoResposta(payload), esperado);
  assert.doesNotMatch(textoResposta(payload), /link estranho pode ser golpe|não envie dinheiro/i);
}

// F) Continuidade curta usa histórico seguro, mas responde à pergunta nova.
{
  const historico = [
    { role: 'user', content: 'Me mandaram mensagem pedindo dinheiro.' },
    { role: 'assistant', content: 'Não envie dinheiro ainda. Confirme por outro caminho.' }
  ];
  const payload = await chamar('Como posso confirmar se é meu sobrinho?', historico);
  assert.equal(classificarRotaPrincipal('Como posso confirmar se é meu sobrinho?', historico), 'continuidade');
  assert.equal(payload.tipo, 'seguranca');
  assert.match(textoResposta(payload), /número antigo|numero antigo|confirm|familiar|confiança|confianca/i);
  assert.doesNotMatch(payload.resposta.respostaSimples, /^Não faça pagamento nem envie dados agora\./i, 'não repete apenas o bloco anterior quando há pergunta específica');
}

// G) Continuidade de escolha expande a pergunta antes da IA.
{
  const historico = [
    { role: 'user', content: 'Como aumento o volume?' },
    { role: 'assistant', content: 'Você usa Android, iPhone ou computador?' }
  ];
  const continuidade = detectarContinuidadeDeEscolha('Android', historico);
  assert.equal(continuidade?.perguntaExpandida, 'Como aumentar o volume no Android?');
  const payload = await chamar('Android', historico);
  assert.equal(payload.tipo, 'duvida_digital');
  assert.match(textoResposta(payload), /android|volume|botões|botoes|lateral/i);
}

{
  const historico = [
    { role: 'user', content: 'Como apago o aplicativo?' },
    { role: 'assistant', content: 'Você usa Android, iPhone ou computador?' }
  ];
  const continuidade = detectarContinuidadeDeEscolha('iPhone', historico);
  assert.equal(continuidade?.perguntaExpandida, 'Como apagar o aplicativo no iPhone?');
  const payload = await chamar('iPhone', historico);
  assert.equal(payload.tipo, 'duvida_digital');
  assert.match(textoResposta(payload), /iphone|apagar app|remover app|aplicativo/i);
}

// H) Debug seguro só aparece com SERGIO_DEBUG=true e mascara dados sensíveis.
{
  const antigoDebug = process.env.SERGIO_DEBUG;
  process.env.SERGIO_DEBUG = 'true';
  const payload = await chamar('Minha senha é 123456');
  assert.ok(payload.debugSeguro, 'debugSeguro presente quando SERGIO_DEBUG=true');
  assert.equal(payload.debugSeguro.perguntaNormalizada.includes('123456'), false, 'debug sem senha literal');
  for (const campo of ['perguntaNormalizada', 'perguntaEfetiva', 'rotaPrincipal', 'guiaEscolhido', 'chamouIA', 'iaOk', 'validacaoRejeitou', 'motivoValidacao', 'fallbackUsado', 'motivoFallback', 'origemFinal']) {
    assert.ok(Object.hasOwn(payload.debugSeguro, campo), `debugSeguro contém ${campo}`);
  }
  assert.equal(Object.hasOwn(payload.debugSeguro, 'stack'), false, 'debug sem stack trace');
  const debugDigital = await chamar('Como abrir o Facebook?');
  assert.equal(debugDigital.debugSeguro.chamouIA, true);
  assert.equal(debugDigital.debugSeguro.iaOk, true);
  assert.equal(debugDigital.debugSeguro.fallbackUsado, false);
  const chave = process.env.NVIDIA_API_KEY;
  delete process.env.NVIDIA_API_KEY;
  const debugFallback = await chamar('como aumentar volume celular');
  assert.equal(debugFallback.debugSeguro.chamouIA, false);
  assert.equal(debugFallback.debugSeguro.iaOk, false);
  assert.equal(debugFallback.debugSeguro.fallbackUsado, true);
  assert.equal(debugFallback.debugSeguro.motivoFallback, 'ia_indisponivel');
  process.env.NVIDIA_API_KEY = chave;
  process.env.SERGIO_DEBUG = 'false';
  const semDebug = await chamar('Como abrir o Facebook?');
  assert.equal(semDebug.debugSeguro, undefined, 'debugSeguro ausente sem SERGIO_DEBUG=true');
  if (antigoDebug === undefined) delete process.env.SERGIO_DEBUG; else process.env.SERGIO_DEBUG = antigoDebug;
}

// G) Validador pós-IA barra respostas inseguras, mas permite alertas preventivos.
{
  const pacoteIA = montarPacoteIA('Me mandaram mensagem pedindo dinheiro.', 'risco_real', GUIAS_LOCAIS.risco_real, []);
  const insegura = validarRespostaIA({ respostaSimples: 'Faça o Pix e confirme o pagamento.', passoAPasso: [], alertaHumano: '' }, pacoteIA);
  assert.equal(insegura.ok, false);
  assert.match(insegura.motivo, /pagamento|alerta/i);
  const pacoteDigital = montarPacoteIA('Estão me ligando no WhatsApp.', 'duvida_digital', GUIAS_LOCAIS.tecnologia, []);
  const preventiva = validarRespostaIA({ respostaSimples: 'Não passe senha, código, CPF, banco ou documento pelo WhatsApp.', passoAPasso: ['Não clique em link estranho recebido por mensagem.'], alertaHumano: '' }, pacoteDigital);
  assert.equal(preventiva.ok, true);
}

// G) Segurança técnica solicitada.
const arquivosCodigo = [
  'api/sergio.js',
  'api/voz/transcrever.py',
  'js/app.js',
  'js/ai.js',
  'js/sergio.js',
  'service-worker.js'
];
const codigo = arquivosCodigo.map((arquivo) => fs.readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8')).join('\n');
assert.ok(!codigo.includes('nvapi-'), 'sem chave nvapi- no código');
assert.doesNotMatch(fs.readFileSync(new URL('../js/ai.js', import.meta.url), 'utf8'), /NVIDIA_API_KEY|integrate\.api\.nvidia|Authorization/i, 'sem API key NVIDIA no frontend');
assert.match(fs.readFileSync(new URL('../api/sergio.js', import.meta.url), 'utf8'), /Cache-Control'.*no-store/s, '/api/sergio com no-store');
assert.match(fs.readFileSync(new URL('../api/voz/transcrever.py', import.meta.url), 'utf8'), /Cache-Control.*no-store/s, '/api/voz/transcrever com no-store');
assert.match(fs.readFileSync(new URL('../api/voz/transcrever.py', import.meta.url), 'utf8'), /NamedTemporaryFile\([^\n]*delete=True/s, 'áudio temporário sem salvamento persistente');
assert.doesNotMatch(fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8'), /enviarPerguntaSergio\([^)]*transcricao/i, 'voz não envia automaticamente para o chat');

assert.equal(normalizarTexto('pagar com piks'), 'pagar com pix');
assert.ok(contemRiscoReal('Uma pessoa com foto do meu filho está pedindo dinheiro.'));

globalThis.fetch = fetchOriginal;

console.log('OK: Sérgio IA-first com guias locais, guardrails e segurança técnica validados.');
