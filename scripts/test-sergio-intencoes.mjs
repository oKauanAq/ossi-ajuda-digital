import assert from 'node:assert/strict';
import handler, { detectarIntencao, normalizarTexto, contemTermoRisco } from '../api/sergio.js';

function criarReq(pergunta, historico = []) {
  return { method: 'POST', body: { pergunta, historico } };
}

function criarRes() {
  return {
    statusCode: 0,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

async function chamar(pergunta, historico = []) {
  const res = criarRes();
  await handler(criarReq(pergunta, historico), res);
  assert.equal(res.statusCode, 200, `status de "${pergunta}"`);
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

function assertSemNumeracaoDuplicada(payload, pergunta) {
  for (const passo of payload.resposta?.passoAPasso || []) {
    assert.ok(!/^\s*\d+[.)-]\s*\d+[.)-]/.test(passo), `sem número duplicado em "${pergunta}"`);
  }
}

const casos = [
  // Senha/conta
  ['esqueci minha senha', 'senha_generica', 'seguranca'],
  ['não consigo entrar', 'senha_generica', 'seguranca'],
  ['recuperar conta', 'senha_generica', 'seguranca'],
  ['minha conta bloqueou', 'senha_generica', 'seguranca'],
  ['esqueci minha senha no whatsapp', 'senha_whatsapp', 'seguranca'],
  ['vou recuperar minha senha no whatsapp', 'senha_whatsapp', 'seguranca'],
  ['recuperar minha senha no whatsapp', 'senha_whatsapp', 'seguranca'],
  ['senha no whatsappp', 'senha_whatsapp', 'seguranca'],
  ['senha no whastapp', 'senha_whatsapp', 'seguranca'],
  ['não consigo entrar no facebook', 'senha_facebook', 'seguranca'],
  ['esqueci senha do gov.br', 'senha_gov', 'seguranca'],
  ['esqueci senha do banco', 'senha_banco', 'seguranca'],
  ['recuperar email', 'senha_email', 'seguranca'],
  ['não consigo entrar no instagram', 'senha_instagram', 'seguranca'],

  // Pix/banco
  ['como fazer pix com segurança', 'pix_como_fazer', 'seguranca'],
  ['fazer um pix', 'pix_como_fazer', 'seguranca'],
  ['enviar pix', 'pix_como_fazer', 'seguranca'],
  ['pagar com piks', 'pix_como_fazer', 'seguranca'],
  ['me pediram pix urgente', 'pix_urgente_golpe', 'seguranca'],
  ['vou mandar 3000 no pix', 'pix_valor_alto', 'seguranca'],
  ['vou mandar três mil no pix', 'pix_valor_alto', 'seguranca'],
  ['meu tio está pedindo trinta mil reais', 'dinheiro_familiar_ou_valor_alto', 'seguranca'],
  ['uma pessoa com cara do meu sobrinho está pedindo trinta mil reais', 'dinheiro_familiar_ou_valor_alto', 'seguranca'],
  ['meu sobrinho pediu 3000 no pix', 'dinheiro_familiar_ou_valor_alto', 'seguranca'],
  ['vou fazer pix de 3000', 'pix_valor_alto', 'seguranca'],
  ['mandar dinheiro para desconhecido', 'pix_valor_alto', 'seguranca'],
  ['pessoa desconhecida pediu dinheiro', 'pix_valor_alto', 'seguranca'],
  ['pix para pessoa que não conheço', 'pix_valor_alto', 'seguranca'],
  ['pediram dinheiro urgente', 'pix_valor_alto', 'seguranca'],
  ['problema no banco', 'banco_generico', 'seguranca'],
  ['não consigo entrar no app do banco', 'senha_banco', 'seguranca'],
  ['como ver saldo', 'banco_generico', 'seguranca'],

  // Golpes
  ['recebi link estranho', 'link_suspeito', 'seguranca'],
  ['recebi link estra', 'link_suspeito', 'seguranca'],
  ['cliquei em um link', 'link_suspeito', 'seguranca'],
  ['número novo dizendo que é meu filho pediu pix', 'golpe_familiar_falso', 'seguranca'],
  ['foto do meu irmão pedindo dinheiro', 'dinheiro_familiar_ou_valor_alto', 'seguranca'],
  ['minha mãe pediu dinheiro por outro número', 'golpe_familiar_falso', 'seguranca'],
  ['loja é confiável?', 'loja_confiavel', 'consulta_loja_site'],
  ['site é confiável?', 'loja_confiavel', 'consulta_loja_site'],
  ['preço muito barato', 'loja_confiavel', 'consulta_loja_site'],
  ['posso comprar nessa loja?', 'loja_confiavel', 'consulta_loja_site'],

  // WhatsApp
  ['como mandar mensagem no whatsapp', 'whatsapp_mensagem', 'duvida_digital'],
  ['como colocar foto no whatsapp', 'whatsapp_foto', 'duvida_digital'],
  ['recebi link no whatsapp', 'link_suspeito', 'seguranca'],
  ['whatsapp não abre', 'whatsapp_generico', 'duvida_digital'],
  ['perdi acesso ao whatsapp', 'senha_whatsapp', 'seguranca'],
  ['como salvar contato no whatsapp', 'whatsapp_contato', 'duvida_digital'],
  ['como mandar audio no whatsapp', 'whatsapp_audio', 'duvida_digital'],

  // Celular
  ['como aumentar o volume', 'celular_volume', 'duvida_digital'],
  ['celular está sem som', 'celular_sem_som', 'duvida_digital'],
  ['como conectar no wifi', 'celular_wifi', 'duvida_digital'],
  ['como tirar print', 'celular_print', 'duvida_digital'],
  ['como instalar na tela inicial', 'instalar_pwa', 'duvida_digital'],
  ['conectar no wi-fi', 'celular_wifi', 'duvida_digital'],
  ['captura de tela', 'celular_print', 'duvida_digital'],

  // Incompreensível
  ['tastando', 'incompreensivel', 'saudacao_ou_vaga'],
  ['pesquise me senhora', 'incompreensivel', 'saudacao_ou_vaga'],
  ['escusei me senhora', 'incompreensivel', 'saudacao_ou_vaga'],
  ['me senhora', 'incompreensivel', 'saudacao_ou_vaga'],
  ['abc', 'incompreensivel', 'saudacao_ou_vaga'],
  ['oi', 'incompreensivel', 'saudacao_ou_vaga'],
  ['teste', 'incompreensivel', 'saudacao_ou_vaga'],

  // Geral
  ['quem é o Bob Esponja', 'bob_esponja', 'duvida_geral'],
  ['Quem é Mark Zuckerberg?', 'mark_zuckerberg', 'duvida_geral'],
  ['Quem é Lara Croft?', 'lara_croft', 'duvida_geral'],
  ['Me faça uma lista de perguntas para treinar o uso de celular.', 'lista_treino_celular', 'duvida_geral'],
  ['o que é anime', null, 'fallback'],
  ['o que é mangá', null, 'fallback'],
  ['qual o oitavo planeta', null, 'fallback'],
  ['por que o céu é azul', null, 'fallback'],
  ['o que é futebol', null, 'fallback'],
  ['quem inventou o avião', null, 'fallback']
];

const normalizacoes = new Map([
  ['whatsappp', 'whatsapp'],
  ['whastapp', 'whatsapp'],
  ['zap', 'whatsapp'],
  ['gov br', 'gov.br'],
  ['govbr', 'gov.br'],
  ['minhas senha', 'minha senha'],
  ['esqueci minhas senha', 'esqueci minha senha'],
  ['senha no whatsappp', 'senha no whatsapp'],
  ['piks', 'pix'],
  ['pique', 'pix'],
  ['link estra', 'link estranho'],
  ['link estranha', 'link estranho']
]);

for (const [entrada, esperado] of normalizacoes) {
  const normalizado = normalizarTexto(entrada);
  assert.equal(normalizado, esperado, `normalização de "${entrada}"`);
  assert.ok(!normalizado.includes('whatsappp'), 'não deve manter whatsappp');
}

for (const [pergunta, idEsperado, tipoEsperado] of casos) {
  const detectada = detectarIntencao(pergunta);
  assert.equal(detectada?.id ?? null, idEsperado, `intenção de "${pergunta}"`);
  const payload = await chamar(pergunta);
  assert.equal(payload.tipo, tipoEsperado, `tipo público de "${pergunta}"`);
  assertSemJsonCru(payload, pergunta);
  assertSemNumeracaoDuplicada(payload, pergunta);

  if (contemTermoRisco(pergunta)) {
    assert.notEqual(payload.origem, 'ia', `risco não deve ir para IA em "${pergunta}"`);
    assert.notEqual(payload.origem, 'ia_com_contexto', `risco não deve ir para IA com contexto em "${pergunta}"`);
  }
}



const historicoContaminado = [
  { role: 'user', content: 'Recebi um link estranho e falaram de Pix.' },
  { role: 'assistant', content: 'Link estranho pode ser golpe. Não clique.' }
];

for (const perguntaGeral of ['Quem é Mark Zuckerberg?', 'Me faça uma lista de perguntas para treinar o uso de celular.', 'Quem é Lara Croft?']) {
  const payload = await chamar(perguntaGeral, historicoContaminado);
  assert.notEqual(payload.resposta.respostaSimples, 'Link estranho pode ser golpe. Não clique e não preencha dados.', `sem contaminação de link em "${perguntaGeral}"`);
  assert.notEqual(payload.tipo, 'seguranca', `histórico não transforma pergunta geral em segurança em "${perguntaGeral}"`);
  assert.doesNotMatch(textoResposta(payload), /link estranho pode ser golpe|pedido de pix urgente|não envie dinheiro agora/i, `sem golpe/link/Pix indevido em "${perguntaGeral}"`);
}

const respostaTioTrintaMil = await chamar('Meu tio está pedindo trinta mil reais.');
assert.equal(respostaTioTrintaMil.origem, 'seguranca_local');
assert.match(respostaTioTrintaMil.resposta.respostaSimples, /Não envie o dinheiro agora/i);
assert.match(respostaTioTrintaMil.resposta.alertaHumano, /Obra Social Santa Isabel/);
assert.doesNotMatch(respostaTioTrintaMil.resposta.respostaSimples, /\bpor$/i, 'resposta do tio não termina em por');
assert.ok(/[.!?]$/.test(respostaTioTrintaMil.resposta.respostaSimples), 'resposta do tio termina com pontuação');

for (const pergunta of [
  'Meu tio está pedindo trinta mil reais.',
  'Uma pessoa com cara do meu sobrinho está pedindo trinta mil reais.',
  'Meu sobrinho pediu 3000 no Pix.'
]) {
  const payload = await chamar(pergunta);
  assert.equal(payload.tipo, 'seguranca', `familiar/valor alto é segurança em "${pergunta}"`);
  assert.equal(detectarIntencao(pergunta)?.id, 'dinheiro_familiar_ou_valor_alto', `intenção familiar/valor alto em "${pergunta}"`);
  assert.match(textoResposta(payload), /não envie|não faça pix|não faça transferência/i, `orienta não enviar dinheiro em "${pergunta}"`);
  assert.match(textoResposta(payload), /familiar|parente|ligue/i, `orienta confirmar familiar em "${pergunta}"`);
  assert.match(textoResposta(payload), /Obra Social Santa Isabel/i, `orienta Obra Social Santa Isabel em "${pergunta}"`);
}

const respostaMark = await chamar('Quem é Mark Zuckerberg?');
assert.equal(respostaMark.tipo, 'duvida_geral');
assert.match(respostaMark.resposta.respostaSimples, /Facebook|Meta/i);
assert.doesNotMatch(textoResposta(respostaMark), /link estranho pode ser golpe/i);

const respostaListaTreino = await chamar('Me faça uma lista de perguntas para treinar o uso de celular.');
assert.equal(respostaListaTreino.tipo, 'duvida_geral');
assert.match(respostaListaTreino.resposta.respostaSimples, /aumentar o volume|Wi-Fi|WhatsApp|tirar print/i);
assert.doesNotMatch(textoResposta(respostaListaTreino), /alerta humano|Essa situação é arriscada|Link estranho pode ser golpe/i);

const respostaRepitaSemHistorico = await chamar('repita');
assert.match(respostaRepitaSemHistorico.resposta.respostaSimples, /preciso que você me diga qual era a dúvida/i);

const respostaRepitaComHistorico = await chamar('sua resposta saiu quebrada, repita', [
  { role: 'assistant', content: 'Vamos aumentar o volume com calma. Aperte o botão de cima na lateral.' }
]);
assert.match(respostaRepitaComHistorico.resposta.respostaSimples, /Desculpe, vou repetir com calma/i);
assert.match(respostaRepitaComHistorico.resposta.respostaSimples, /aumentar o volume/i);

const respostaBobEsponja = await chamar('quem é o Bob Esponja');
assert.ok(respostaBobEsponja.resposta.respostaSimples.includes('uma esponja amarela'), 'Bob Esponja deve ser uma esponja amarela');
assert.ok(!respostaBobEsponja.resposta.respostaSimples.includes('um esponja amarelo'), 'Bob Esponja não deve ter concordância incorreta');

const respostaSenhaGenerica = await chamar('esqueci minha senha');
assert.deepEqual(respostaSenhaGenerica.resposta.opcoesFluxo, ['Facebook', 'Instagram', 'Gov.br', 'Banco', 'E-mail', 'WhatsApp', 'Outro aplicativo']);

const respostaBanco = await chamar('problema no banco');
assert.deepEqual(respostaBanco.resposta.opcoesFluxo, ['Pix', 'Entrar no app', 'Ver saldo', 'Outro assunto']);

const respostaWhatsapp = await chamar('whatsapp não abre');
assert.deepEqual(respostaWhatsapp.resposta.opcoesFluxo, ['Mandar mensagem', 'Colocar foto', 'Recuperar conta', 'Verificar golpe']);

const respostaPixAlto = await chamar('vou mandar 3000 no pix');
assert.match(respostaPixAlto.resposta.respostaSimples, /arriscada/i);
assert.match(respostaPixAlto.resposta.alertaHumano, /Obra Social Santa Isabel/);

const respostaFamiliarFoto = await chamar('uma pessoa com foto do meu filho está pedindo dinheiro');
assert.match(respostaFamiliarFoto.resposta.alertaHumano, /familiar de confiança|Obra Social Santa Isabel/);

const respostaVolume = await chamar('como aumentar o volume');
assert.equal(respostaVolume.resposta.alertaHumano, '', 'volume não deve mostrar alerta humano');

const respostaBobSemAlerta = await chamar('quem é o Bob Esponja');
assert.equal(respostaBobSemAlerta.resposta.alertaHumano, '', 'Bob Esponja não deve mostrar alerta humano');

console.log(`OK: ${casos.length} perguntas e ${normalizacoes.size} normalizações validadas.`);
