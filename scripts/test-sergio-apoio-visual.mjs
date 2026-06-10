import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import handler from '../api/sergio.js';

const codigoFrontend = fs.readFileSync(new URL('../js/sergio.js', import.meta.url), 'utf8');
const contexto = {};
vm.createContext(contexto);
vm.runInContext(codigoFrontend, contexto);

function criarReq(pergunta) {
  return { method: 'POST', body: { pergunta, historico: [] } };
}

function criarRes() {
  return {
    statusCode: 0,
    payload: null,
    headers: {},
    setHeader(nome, valor) { this.headers[nome.toLowerCase()] = valor; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

async function responder(pergunta) {
  const res = criarRes();
  await handler(criarReq(pergunta), res);
  assert.equal(res.statusCode, 200, `status de "${pergunta}"`);
  assert.match(res.headers['cache-control'], /no-store/i);
  assert.ok(res.payload?.resposta?.respostaSimples, `resposta simples de "${pergunta}"`);
  return res.payload;
}

async function apoioVisual(pergunta) {
  const payload = await responder(pergunta);
  return {
    payload,
    apoio: contexto.detectarApoioVisual(payload.resposta.respostaSimples, pergunta, payload.tipo)
  };
}

for (const pergunta of ['vou recuperar minha senha no WhatsApp', 'senha no whatsappp']) {
  const senhaWhatsApp = await apoioVisual(pergunta);
  assert.match(senhaWhatsApp.payload.origem, /ia_orientada|fallback_local_orientado|fallback_local_seguro/);
  assert.match(senhaWhatsApp.payload.resposta.respostaSimples, /senha|aplicativo|dúvida digital|duvida digital|WhatsApp/i);
  assert.equal(senhaWhatsApp.apoio?.emoji, '🔐');
  assert.equal(senhaWhatsApp.apoio?.titulo, 'Senha e conta');
}

const golpeFamiliar = await apoioVisual('uma pessoa com foto do meu filho está pedindo dinheiro');
assert.equal(golpeFamiliar.apoio?.emoji, '🛡️');
assert.equal(golpeFamiliar.apoio?.titulo, 'Cuidado com golpe');

const ligacaoWhatsApp = await apoioVisual('estam me ligando no whatsaapp');
assert.equal(ligacaoWhatsApp.apoio?.emoji, '🟢');
assert.equal(ligacaoWhatsApp.apoio?.titulo, 'WhatsApp');

const ligacaoWhatsAppComCodigo = await apoioVisual('estão me ligando no WhatsApp pedindo código');
assert.equal(ligacaoWhatsAppComCodigo.apoio?.emoji, '🛡️');
assert.equal(ligacaoWhatsAppComCodigo.apoio?.titulo, 'Cuidado com golpe');

const linkEstranho = await apoioVisual('recebi um link estranho no WhatsApp');
assert.equal(linkEstranho.apoio?.emoji, '🛡️');
assert.equal(linkEstranho.apoio?.titulo, 'Cuidado com golpe');

const golpeExplicito = await apoioVisual('acho que é golpe');
assert.equal(golpeExplicito.apoio?.emoji, '🛡️');
assert.equal(golpeExplicito.apoio?.titulo, 'Cuidado com golpe');

const numeroDesconhecido = await apoioVisual('número desconhecido');
assert.equal(numeroDesconhecido.apoio?.emoji, '🛡️');
assert.equal(numeroDesconhecido.apoio?.titulo, 'Cuidado com golpe');

const pixSeguro = await apoioVisual('como fazer Pix com segurança');
assert.equal(pixSeguro.apoio?.emoji, '💳');
assert.equal(pixSeguro.apoio?.titulo, 'Banco e Pix');

const bobEsponja = await responder('quem é o Bob Esponja');
assert.match(bobEsponja.resposta.respostaSimples, /uma esponja amarela/);
assert.doesNotMatch(bobEsponja.resposta.respostaSimples, /um esponja amarelo/);

console.log('OK: apoio visual compatível com Sérgio IA-first validado.');
