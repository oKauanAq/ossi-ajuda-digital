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
- Link para formulário externo de avaliação.
- Instruções para adicionar à tela inicial (Android e iPhone).
- PWA com cache offline básico.

## Estrutura
- `index.html`: interface principal.
- `css/style.css`: estilo mobile-first e acessível.
- `js/app.js`: inicialização, navegação, busca e renderização.
- `js/sergio.js`: regras do assistente, segurança e ranqueamento.
- `js/search.js`: busca local usando pontuação.
- `data/faq.json`: base local completa de perguntas e respostas.
- `data/categorias.json`: lista de categorias.
- `manifest.json` e `service-worker.js`: configuração PWA.

## Segurança e limites
- Não coleta dados pessoais.
- Não possui login/cadastro.
- Não possui backend, banco de dados ou API externa.
- Não faz Pix, compras, acesso bancário ou gov.br.


## Integração opcional de IA (Vercel + NVIDIA)
- O projeto continua funcionando no GitHub Pages com biblioteca local (`data/faq.json`).
- A IA é opcional e funciona apenas quando publicado na Vercel com Function em `api/sergio.js`.

### Como configurar na Vercel
1. Importar o repositório na Vercel.
2. Em **Settings > Environment Variables**, criar `NVIDIA_API_KEY`.
3. Opcional: criar `NVIDIA_MODEL` para trocar o modelo sem alterar código. Se não configurar, o projeto usa o modelo padrão atual.
4. Fazer deploy.

### Segurança
- A chave fica somente no backend (`process.env.NVIDIA_API_KEY`).
- Nunca colocar chave no frontend, no GitHub ou em commits.
- Perguntas sensíveis (senha, CPF, cartão, código, documento, Pix, banco, dinheiro, saúde, link suspeito ou golpe) não são enviadas para IA; o sistema responde localmente em modo seguro.

## Modo Voz Beta
- O widget do Sérgio pode receber pergunta por voz quando publicado em ambiente seguro (HTTPS/Vercel ou localhost).
- O navegador grava áudio real do microfone, gera WAV PCM mono de 16 bits no frontend e envia somente para `/api/voz/transcrever`.
- O texto reconhecido aparece para conferência antes de ser enviado ao Sérgio. Nada é enviado automaticamente.
- Não há retorno por voz, TTS ou APIs nativas de reconhecimento de fala do navegador neste modo.
- O áudio é temporário: o endpoint valida tamanho, usa apenas `/tmp` durante a transcrição e não salva arquivo em banco ou armazenamento permanente.

### Variável de ambiente
- `NVIDIA_API_KEY` é necessária na Vercel para o Modo Voz Beta e fica apenas no backend (`process.env.NVIDIA_API_KEY`).
- Nunca coloque a chave no frontend, no GitHub ou em commits.
