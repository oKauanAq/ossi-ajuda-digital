const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';

const termosSensiveis = ['pix','banco','senha','cpf','cartão','codigo','código','documento','saúde','compra','dinheiro','link suspeito','número desconhecido','golpe'];
const padraoSensivel = [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,/\b\d{13,19}\b/,/senha\s*[:=]?/i,/c[oó]digo\s*[:=]?/i,/token\s*[:=]?/i];

function ehSensivel(texto=''){const t=texto.toLowerCase(); return termosSensiveis.some(k=>t.includes(k))||padraoSensivel.some(re=>re.test(texto));}
function respostaSegura(){return {fonte:'local-segura',respostaSimples:'Vamos com calma. Não continue essa ação agora.',passoAPasso:['Não compartilhe dados pessoais.','Não clique em links recebidos.','Não faça Pix ou pagamentos agora.','Converse com uma pessoa de confiança da família ou da OSSI.'],atencao:'Este assistente não faz operações sensíveis e não substitui ajuda humana.',quandoPedirAjuda:'Pare antes de continuar e peça ajuda a uma pessoa de confiança ou responsável da OSSI.'};}
function parseResposta(texto=''){const p={respostaSimples:'',passoAPasso:[],atencao:'',quandoPedirAjuda:''};const lines=texto.trim().split(/\n+/).map(l=>l.trim()).filter(Boolean);let s='';for(const l of lines){const low=l.toLowerCase();if(low.startsWith('resposta simples')){s='r';p.respostaSimples=l.split(':').slice(1).join(':').trim();continue;}if(low.startsWith('passo a passo')){s='p';const r=l.split(':').slice(1).join(':').trim();if(r)p.passoAPasso.push(r);continue;}if(low.startsWith('atenção')||low.startsWith('atencao')){s='a';p.atencao=l.split(':').slice(1).join(':').trim();continue;}if(low.startsWith('quando pedir ajuda')){s='q';p.quandoPedirAjuda=l.split(':').slice(1).join(':').trim();continue;}if(s==='p')p.passoAPasso.push(l.replace(/^[-\d.)\s]+/,'').trim());}
if(!p.respostaSimples||!p.passoAPasso.length||!p.atencao||!p.quandoPedirAjuda)return null;return {fonte:'nvidia',...p};}

export default async function handler(req,res){
 if(req.method!=='POST') return res.status(405).json({erro:'Método não permitido'});
 try{const pergunta=String(req.body?.pergunta||'').trim();
  if(!pergunta||pergunta.length<2||pergunta.length>500) return res.status(400).json({erro:'Pergunta inválida',fallback:true,resposta:respostaSegura()});
  if(ehSensivel(pergunta)) return res.status(200).json({fallback:true,resposta:respostaSegura()});
  const apiKey=process.env.NVIDIA_API_KEY; if(!apiKey) return res.status(200).json({fallback:true,resposta:null});
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),10000);
  const systemPrompt=`O Sérgio é um assistente digital para idosos da Obra Social Santa Isabel.
Ele responde dúvidas simples sobre celular, internet, golpes, banco/Pix, WhatsApp, e-mail, gov.br, compras online, redes sociais e funções básicas do celular.
Ele deve usar linguagem simples, frases curtas, tom calmo, respeitoso e não infantilizado.
Toda resposta deve seguir:
1. Resposta simples
2. Passo a passo
3. Atenção
4. Quando pedir ajuda
Regras de segurança:
Nunca pedir senha, CPF, dados bancários, cartão, código SMS/WhatsApp, documentos ou dados de saúde.
Nunca orientar Pix completo, compra, acesso a banco, acesso ao gov.br, diagnóstico médico ou operação sensível até o fim.
Se a dúvida envolver dinheiro, banco, Pix, senha, CPF, código, documento, saúde, compra, link suspeito, número desconhecido ou medo de golpe, orientar exatamente:
“Pare antes de continuar e peça ajuda a uma pessoa de confiança ou responsável da OSSI.”
Responda somente em português do Brasil. Não exponha raciocínio interno.`;
  const r=await fetch(NVIDIA_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},body:JSON.stringify({model:MODEL,temperature:0.3,max_tokens:700,messages:[{role:'system',content:systemPrompt},{role:'user',content:pergunta}]}),signal:controller.signal});
  clearTimeout(timeout); if(!r.ok) return res.status(200).json({fallback:true,resposta:null});
  const data=await r.json(); const content=data?.choices?.[0]?.message?.content||''; const parsed=parseResposta(content);
  if(!parsed) return res.status(200).json({fallback:true,resposta:null}); return res.status(200).json({fallback:false,resposta:parsed});
 }catch{return res.status(200).json({fallback:true,resposta:null});}
}
