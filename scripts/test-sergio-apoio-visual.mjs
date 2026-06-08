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
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

async function responder(pergunta) {
  const res = criarRes();
  await handler(criarReq(pergunta), res);
  assert.equal(res.statusCode, 200, `status de "${pergunta}"`);
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

const senhaWhatsApp = await apoioVisual('vou recuperar minha senha no WhatsApp');
assert.equal(senhaWhatsApp.payload.origem, 'habilidade_local');
assert.match(senhaWhatsApp.payload.resposta.respostaSimples, /acesso ao WhatsApp/i);
assert.equal(senhaWhatsApp.apoio?.emoji, '🔐');
assert.equal(senhaWhatsApp.apoio?.titulo, 'Senha e conta');

const senhaWhatsappp = await apoioVisual('senha no whatsappp');
assert.equal(senhaWhatsappp.payload.origem, 'habilidade_local');
assert.match(senhaWhatsappp.payload.resposta.respostaSimples, /WhatsApp/i);
assert.equal(senhaWhatsappp.apoio?.emoji, '🔐');
assert.equal(senhaWhatsappp.apoio?.titulo, 'Senha e conta');

const golpeFamiliar = await apoioVisual('uma pessoa com foto do meu filho está pedindo dinheiro');
assert.equal(golpeFamiliar.apoio?.emoji, '🛡️');
assert.equal(golpeFamiliar.apoio?.titulo, 'Cuidado com golpe');

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

console.log('OK: apoio visual e resposta geral do Sérgio validados.');
