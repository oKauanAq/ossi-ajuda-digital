# OSSI Ajuda Digital

PWA estática para apoiar idosos da Obra Social Santa Isabel (OSSI) com dúvidas digitais comuns.

## Tecnologias
- HTML
- CSS
- JavaScript puro
- JSON local
- manifest.json
- service-worker.js

## Funcionalidades
- Tela inicial com logo da OSSI e botões grandes.
- Categorias de dúvidas.
- Biblioteca local de dúvidas frequentes.
- Busca simples.
- Assistente Sérgio baseado em `data/faq.json`.
- Modo Segurança para golpes e situações sensíveis.
- Botão “Ouvir resposta” com `speechSynthesis`.
- Link para formulário externo de avaliação.
- Instruções para adicionar à tela inicial (Android e iPhone).
- PWA com cache offline básico.

## Estrutura
- `index.html`: interface principal.
- `css/style.css`: estilo mobile-first e acessível.
- `js/app.js`: inicialização, navegação e renderização.
- `js/sergio.js`: respostas do assistente e regras de segurança.
- `js/search.js`: busca local.
- `js/tts.js`: leitura em voz alta.
- `data/faq.json`: base local de perguntas e respostas.
- `data/categorias.json`: lista de categorias.
- `manifest.json` e `service-worker.js`: configuração PWA.

## Como usar localmente
1. Hospede os arquivos em servidor estático (ex.: Live Server).
2. Abra `index.html` no navegador.
3. Para testar PWA, use HTTPS ou localhost.

## Publicação no GitHub Pages
1. Suba o repositório para o GitHub.
2. Em **Settings > Pages**, escolha a branch principal e pasta `/root`.
3. Salve e abra a URL publicada.

## Testes sugeridos
- Verificar layout em celular.
- Testar busca por palavras.
- Testar respostas do Sérgio e botão “Ouvir resposta”.
- Testar instalação na tela inicial em Android/iPhone.
- Testar modo offline após primeira carga.

## Segurança e limites
- Não coleta dados pessoais.
- Não possui login/cadastro.
- Não possui backend, banco de dados ou API externa.
- Não faz Pix, compras, acesso bancário ou gov.br.
