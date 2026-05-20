# OSSI Ajuda Digital

PWA para apoiar idosos da Obra Social Santa Isabel (OSSI) com dúvidas digitais e orientação de segurança.

## Tecnologias
- HTML, CSS, JavaScript puro
- JSON local
- Service Worker + Manifest (PWA)
- Vercel Function opcional para IA NVIDIA

## Modos de funcionamento
1. **Modo local (GitHub Pages)**
   - 100% estático, sem IA externa.
   - Usa biblioteca local em `data/faq.json`.

2. **Modo IA opcional (Vercel recomendado)**
   - Frontend tenta chamar `/api/sergio`.
   - Backend serverless chama NVIDIA com segurança.
   - Se falhar, o sistema volta automaticamente para o FAQ local.

## Segurança e privacidade
- Sem login/cadastro.
- Sem banco de dados.
- Sem coleta ou armazenamento de perguntas.
- Sem envio de conteúdo sensível para a IA.
- Chave da NVIDIA **somente no backend** via `process.env.NVIDIA_API_KEY`.

## Estrutura principal
- `index.html`
- `css/style.css`
- `js/app.js`
- `js/sergio.js`
- `js/search.js`
- `js/tts.js`
- `js/ai.js` (cliente para `/api/sergio`)
- `api/sergio.js` (Vercel Function)
- `data/faq.json`
- `data/categorias.json`
- `manifest.json`
- `service-worker.js`

## Deploy na Vercel (IA ativa)
1. Importar este repositório na Vercel.
2. Em **Settings > Environment Variables**, criar:
   - `NVIDIA_API_KEY` = sua chave da NVIDIA.
3. Fazer deploy.
4. Testar o Sérgio:
   - com API disponível (resposta IA),
   - com API indisponível (fallback local automático).

## Deploy no GitHub Pages (sem IA)
- Publicar os arquivos estáticos normalmente.
- O sistema continuará funcionando com FAQ local e busca local.
