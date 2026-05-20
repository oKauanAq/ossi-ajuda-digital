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
- 10 categorias de dúvidas obrigatórias.
- Biblioteca local com 30+ dúvidas frequentes em `data/faq.json`.
- Busca inteligente por pergunta, categoria e palavras-chave.
- Assistente Sérgio baseado no mesmo `faq.json`.
- Modo Segurança para golpes e situações sensíveis.
- Botão “Ouvir resposta” com `speechSynthesis`.
- Link para formulário externo de avaliação.
- Instruções para adicionar à tela inicial (Android e iPhone).
- PWA com cache offline básico.

## Estrutura
- `index.html`: interface principal.
- `css/style.css`: estilo mobile-first e acessível.
- `js/app.js`: inicialização, navegação, busca e renderização.
- `js/sergio.js`: regras do assistente, segurança e ranqueamento.
- `js/search.js`: busca local usando pontuação.
- `js/tts.js`: leitura em voz alta.
- `data/faq.json`: base local completa de perguntas e respostas.
- `data/categorias.json`: lista de categorias.
- `manifest.json` e `service-worker.js`: configuração PWA.

## Segurança e limites
- Não coleta dados pessoais.
- Não possui login/cadastro.
- Não possui backend, banco de dados ou API externa.
- Não faz Pix, compras, acesso bancário ou gov.br.
