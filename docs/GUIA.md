# SCHILLING'S AGENTS — Guia de Implementação
# Para usar com Claude Code

---

## ESTRUTURA DO PROJETO

```
schillings-agents/
├── agents/
│   ├── copy.js          — gera headlines, hooks, copy completa
│   ├── posts.js         — roteiros Instagram/LinkedIn
│   ├── design.js        — gera HTML/CSS + screenshot
│   ├── seo.js           — keywords e estratégia de busca
│   ├── linkedin.js      — artigos e posts profissionais
│   ├── email.js         — sequências de email
│   ├── funil.js         — estrutura do funil de vendas
│   ├── anuncio.js       — copies para Meta Ads
│   └── bot.js           — secretaria Shelly
├── prompts/
│   ├── copy.md
│   ├── posts.md
│   ├── design.md
│   ├── seo-linkedin-email-funil-ads.md
│   └── secretaria-bot.md
├── outputs/             — gerado automaticamente (YYYY-MM-DD/tema/)
├── approved/            — conteúdo aprovado pronto para publicar
├── ui/
│   ├── server.js        — painel de revisão (Express)
│   └── index.html       — interface pixel art
├── bot/
│   └── server.js        — webhook WhatsApp/Instagram
├── docs/
│   └── GUIA.md          — este arquivo
├── main.js              — orquestrador principal
├── .env                 — variáveis de ambiente
└── package.json
```

---

## PASSO 1 — SETUP INICIAL

Cole este prompt no Claude Code:

```
Cria o arquivo package.json para o projeto schillings-agents com as dependências:
@anthropic-ai/sdk, express, puppeteer, fs-extra, dotenv, node-cron, chalk.
Node 18+. Scripts: start (node main.js), dev (node main.js), ui (node ui/server.js), bot (node bot/server.js).
```

Depois:
```
Cria o arquivo .env.example com as variáveis:
ANTHROPIC_API_KEY=your-anthropic-api-key-here
PORT=3000
BOT_PORT=3001
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=
INSTAGRAM_TOKEN=
PIX_KEY=
CLAUDIA_WHATSAPP=+5521972109221
```

---

## PASSO 2 — AGENTE BASE (copiar para todos)

```
Cria agents/copy.js que:
1. Lê o arquivo prompts/copy.md
2. Substitui {topic} pelo argumento recebido
3. Chama a API do Claude com model: claude-sonnet-4-20250514, max_tokens: 2000
4. Salva o resultado em outputs/{data-hoje}/{topic-slug}/copy.md
5. Loga no terminal com chalk (verde quando concluído)
6. Exporta uma função runCopy(topic) para ser chamada pelo orquestrador

Use @anthropic-ai/sdk e dotenv.
```

Repita para cada agente trocando: copy → posts, seo, linkedin, email, funil, anuncio.

---

## PASSO 3 — AGENTE DE DESIGN (especial)

```
Cria agents/design.js que:
1. Lê prompts/design.md
2. Substitui {topic} e {copy_aprovada} (lê outputs/{data}/{topic}/copy.md se existir)
3. Chama Claude pedindo HTML/CSS completo 1080x1080
4. Salva como outputs/{data}/{topic}/design.html
5. Usa puppeteer para abrir o HTML e fazer screenshot 1080x1080
6. Salva screenshot como outputs/{data}/{topic}/design.png
7. Para referências visuais: aceita array de caminhos de imagem, converte para base64 e envia junto na chamada da API como imagens

Detalhe importante do puppeteer:
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 })
  await page.goto('file://' + path.resolve(htmlPath))
  await page.screenshot({ path: pngPath, fullPage: false })
```

---

## PASSO 4 — ORQUESTRADOR

```
Cria main.js que:
1. Recebe o tema como argumento: node main.js "phrasal verbs offshore"
2. Recebe flag opcional --agents copy,posts,seo para rodar só agentes específicos
3. Recebe flag opcional --ref ./referencias/foto.jpg para imagens de referência
4. Roda os agentes nesta ordem: copy → posts → seo → linkedin → email → funil → anuncio → design
5. Design sempre por último pois usa o copy aprovado
6. Loga progresso pixel art no terminal (ASCII art simples com chalk)
7. No final, abre http://localhost:3000 automaticamente
8. Cria outputs/{data}/{topic-slug}/ se não existir

Exemplo de uso:
  node main.js "inglês para entrevista offshore"
  node main.js "phrasal verbs viagem" --agents copy,posts,design
  node main.js "vocabulário técnico" --ref ./refs/concorrente.jpg
```

---

## PASSO 5 — PAINEL DE REVISÃO

```
Cria ui/server.js e ui/index.html com:

Backend (Express):
- GET /api/sessions — lista todas as pastas em outputs/
- GET /api/session/:date/:topic — lista arquivos da sessão
- GET /api/content/:date/:topic/:agent — retorna conteúdo do arquivo
- GET /api/image/:date/:topic — serve design.png
- POST /api/approve/:date/:topic/:agent — move para approved/ e salva metadado
- POST /api/reject/:date/:topic/:agent — salva feedback e cria arquivo .rejected
- POST /api/rerun/:date/:topic/:agent — reexecuta agente específico com feedback

Frontend (index.html) — ESTILO PIXEL ART:
- Fonte: 'Press Start 2P' (Google Fonts) para títulos
- Background: #1a1a2e (azul escuro quase preto)
- Cores: vermelho #e94560, verde #64ffda, amarelo #ffd700
- Layout: sidebar com lista de sessões + área principal com tabs por agente
- Cada agente tem: área de texto editável + botão APROVAR (verde) + botão REJEITAR (vermelho) + campo de feedback
- Design.png exibido inline com botão de zoom
- Status de cada agente: idle / running / aguardando revisão / aprovado / rejeitado
- Sons pixelados opcionais (Web Audio API, bem simples)
```

---

## PASSO 6 — SECRETARIA BOT (Shelly)

```
Cria bot/server.js com:

1. Webhook Express para receber mensagens do WhatsApp (Twilio) e Instagram
2. Para cada mensagem recebida:
   - Identifica o fluxo pelo conteúdo (novo contato, dúvida, offshore, pagamento)
   - Chama Claude com o system prompt da Shelly (prompts/secretaria-bot.md)
   - Inclui no contexto: histórico das últimas 5 mensagens do usuário
   - Envia resposta via Twilio/Instagram API
3. Cron jobs:
   - Todo dia às 18h: verifica aulas do dia seguinte e envia lembretes
   - Todo dia às 8h: envia lembrete de aulas do dia
   - No dia do vencimento: envia lembrete de pagamento

System prompt da Shelly (enviar junto com cada chamada API):
"Você é Shelly, assistente virtual da Schilling's English Course.
[conteúdo do prompts/secretaria-bot.md]
Responda SEMPRE em no máximo 3 parágrafos curtos.
Nunca invente informações sobre preços ou horários específicos.
Quando não souber, diga: 'Vou verificar com a professora Cláudia e te respondo em breve!'"

4. Para treinar/melhorar:
   - Loga TODAS as conversas em bot/logs/{data}.json
   - Interface simples em bot/logs.html para revisar conversas
```

---

## PASSO 7 — TREINAR O AGENTE DE DESIGN COM REFERÊNCIAS

```
Cria um script tools/add-reference.js que:
1. Recebe caminho de uma imagem: node tools/add-reference.js ./minha-ref.jpg "post offshore"
2. Converte para base64
3. Salva em references/{slug}.json com: { base64, description, tags: [] }
4. Lista de referências fica em references/index.json

No agents/design.js, antes de chamar a API:
1. Lê references/index.json
2. Para o tema atual, filtra referências com tags relevantes
3. Envia as imagens junto na chamada API como:
   { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } }
4. No prompt: "Analise estas referências visuais e mantenha coerência com o estilo da marca"
```

---

## FLUXO COMPLETO DE USO

```
1. node main.js "inglês para entrevista offshore"
   → 8 agentes rodam em sequência
   → outputs/2025-03-16/ingles-entrevista-offshore/ criado

2. Abre localhost:3000
   → Você revisa copy, posts, SEO...
   → Edita o que quiser inline
   → Clica APROVAR ou REJEITAR com feedback

3. Rejeição com feedback:
   → node main.js "inglês offshore" --agents copy --feedback "Tom muito formal, mais direto"
   → Agente reexecuta com o feedback no prompt

4. Aprovação:
   → Arquivo vai para approved/2025-03-16/ingles-offshore/
   → Fila de publicação futura

5. Bot roda separado:
   → node bot/server.js
   → Fica escutando WhatsApp + Instagram 24/7
```

---

## DICAS IMPORTANTES

### Sobre qualidade dos prompts
- Os prompts em `prompts/` são seus ativos mais valiosos — itere neles sempre
- Após aprovar ou rejeitar conteúdo, anote o que funcionou no próprio .md
- Adicione exemplos de outputs aprovados no final de cada prompt como "EXEMPLO DE QUALIDADE"

### Sobre o agente de design
- Comece simples: Claude gera HTML, você vê no browser, aprova, aí adiciona puppeteer
- Mande sempre as fotos reais do curso como referência
- O agente melhora muito quando você adiciona exemplos de HTML aprovados no prompt

### Sobre a Shelly (bot)
- Teste muito no WhatsApp antes de colocar pra alunos reais
- Sempre tenha um "escape" para a Cláudia — nunca deixe o bot sozinho em situação complexa
- Comece só com os fluxos 1 e 2 (dúvidas + lembretes) antes de cobranças

### Ordem de implementação recomendada
1. Agentes de texto (copy, posts) — mais simples, resultado imediato
2. Painel de revisão — essencial antes de qualquer publicação
3. Agente de design — mais complexo, mas impacto visual enorme
4. Secretaria bot — deixar para quando o resto estiver funcionando
