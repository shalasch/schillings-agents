# SCHILLING'S AGENTS — Status do Projeto
> Atualizado em: 2026-03-17

---

## STACK
- **Runtime:** Node.js 18+ (ESM)
- **AI:** @anthropic-ai/sdk — modelo `claude-sonnet-4-20250514`
- **UI:** Express + HTML/CSS/JS puro (sem framework)
- **Screenshots:** Puppeteer
- **CLI:** chalk, fs-extra, dotenv

---

## ✅ O QUE JÁ ESTÁ IMPLEMENTADO

### Agentes de conteúdo (`agents/`)
| Arquivo | Função | Status |
|---------|--------|--------|
| `agents/copy.js` | Headlines, hooks, copy completa | ✅ Funcional |
| `agents/posts.js` | Roteiros Instagram/LinkedIn | ✅ Funcional |
| `agents/seo.js` | Keywords e estratégia SEO | ✅ Funcional |
| `agents/linkedin.js` | Artigos e posts profissionais | ✅ Funcional |
| `agents/email.js` | Sequências de email | ✅ Funcional |
| `agents/funil.js` | Estrutura do funil de vendas | ✅ Funcional |
| `agents/anuncio.js` | Copies para Meta Ads | ✅ Funcional |
| `agents/design.js` | HTML/CSS 1080x1080 + screenshot PNG via Puppeteer | ✅ Funcional |

### Orquestrador (`main.js`)
- Roda todos os agentes em sequência via CLI: `node main.js "tema"`
- Flag `--agents copy,posts,seo` para rodar agentes específicos
- Design sempre por último (depende do copy)
- Output em `outputs/YYYY-MM-DD/tema-slug/`
- Banner ASCII art no terminal com chalk

### Painel de revisão (`ui/`)
- **`ui/server.js`** — Express com SSE (roda agentes em tempo real), APIs de conteúdo/aprovação/rejeição/rerun
- **`ui/index.html`** — Interface pixel art estilo Pokémon GBA

#### UI — O que está implementado:
- Dois quartos (sala dos agentes + sala de aprovação) com paredes, chão grid, decorações
- 8 sprites de personagens gerados via CSS box-shadow (função `makeSprite`)
- Personagem Cláudia na sala direita
- Animação `typeBounce` ao rodar agente
- Indicadores flutuantes (✓ / ! / ...) sobre cada personagem
- Monitor da mesa muda de cor por estado (idle/running/done/error/approved)
- Dialog box estilo RPG no rodapé com portrait + typewriter effect (28ms/char)
- Modal estilo Pokédex ao clicar em agente (conteúdo editável + GameBoy frame para design.png)
- Lightbox ao clicar na imagem do design
- SSE stream para acompanhar run em tempo real
- Seleção individual de agentes com checkbox
- Lista de sessões anteriores no painel direito
- Scanlines CRT no fundo

### Prompts (`prompts/`)
- `copy.md` — identidade de copy da Schilling's
- `posts.md` — roteiros de post
- `design.md` — identidade visual + instruções de HTML/CSS 1080x1080
- `seo-linkedin-email-funil-ads.md` — prompt único separado por `---\n---`
- `secretaria-bot.md` — prompt da Shelly (bot ainda não implementado)

### Outputs
- Testado com sucesso: `outputs/2026-03-17/ingles-para-entrevista-offshore/`
- Todos os 8 agentes geraram conteúdo (copy, posts, seo, linkedin, email, funil, anuncio, design.html + design.png)

---

## ✅ SESSÃO 2026-03-17 — O QUE FOI FEITO

### UI — melhorias visuais (todas concluídas)
- [x] Sprites mais detalhados: cabelo nas laterais, boca, colarinho branco, braços de skin
- [x] Barra de nome no dialog box (`■ COPY`, `■ DESIGN` etc.)
- [x] Transição pixelada ao abrir modal (flash + modalPopIn em steps)
- [x] Balão `!` ao clicar em agente (`.click-bubble` com animação pop)
- [x] Sons pixel art — Web Audio API: tick typewriter, open modal, approve, reject, run, done, error
- [x] Layout Cláudia vs painel de sessões corrigido (Cláudia no canto esquerdo, sessões abaixo de 172px)

### Design com referências
- [x] `tools/add-reference.js` — adiciona/lista/remove imagens de referência em `references/`
- [x] `agents/design.js` — carrega `references/` e envia como image blocks na API (máx 3)

### Bot Shelly
- [x] `bot/db.js` — persistência JSON (conversas em `bot/logs/`, alunos em `bot/data/alunos.json`)
- [x] `bot/shelly.js` — Claude API com histórico (últimas 5 mensagens por contato)
- [x] `bot/whatsapp.js` — envio via Twilio REST (Z-API comentado como alternativa)
- [x] `bot/cron.js` — 3 jobs: 08h (aula do dia), 18h (véspera), 09h (cobranças)
- [x] `bot/server.js` — webhook `/webhook/whatsapp`, `/webhook/zapi`, API de logs
- [x] `bot/logs.html` — painel de revisão de conversas estilo pixel art

---

## 🔧 O QUE ESTAVA SENDO FEITO AGORA

**Melhorias visuais na UI (`ui/index.html`)** — estilo Pokémon GBA mais fiel.

Plano em ordem de execução:
1. **Sprites mais detalhados** ✅ FEITO (sessão 2026-03-17)
   - Cabelo nas laterais da testa (row 2)
   - Boca/mouth pixel na row 4 (cor #c87060)
   - Colarinho branco na row 6
   - Braços de skin nas colunas 0 e 7 das rows 7-8
   - `makePortrait()` atualizado da mesma forma
2. **Barra de nome no dialog box** ✅ FEITO (sessão 2026-03-17)
   - `#dialog-name-bar` acima do `#dialog-text`
   - `typeDialog(text, name)` aceita nome opcional (default 'CLÁUDIA')
   - Agentes passam o próprio label nas mensagens SSE
3. **Transição ao abrir modal** ✅ FEITO (sessão 2026-03-17)
   - Flash branco pixelado (`#modal-flash`) com `steps(4)`
   - `#modal-box` anima com `modalPopIn` em `steps(4)` ao abrir

---

## ❌ O QUE AINDA FALTA

### UI — melhorias visuais
- [x] Sprites com mais detalhe pixel art (braços, boca, colarinho)
- [x] Barra de nome no dialog box (ex: `■ COPY`)
- [x] Transição de abertura do modal (flash/wipe GBA)
- [x] Balão `!` acima do personagem ao ser clicado
- [x] Sons pixel art — Web Audio API (typewriter, aprovação, rejeição, run, done, error)
- [x] Cláudia separada do painel de sessões (layout corrigido)
- [ ] Walk cycle (animação de caminhar — baixa prioridade)

### Bot Shelly
- [x] `bot/server.js` — webhook WhatsApp (Twilio) + painel logs
- [x] `bot/shelly.js` — Claude API com contexto (últimas 5 mensagens)
- [x] `bot/cron.js` — 3 jobs automáticos (aula do dia, véspera, cobranças)
- [x] `bot/logs.html` — painel de revisão pixel art
- [ ] Configurar `.env`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `PIX_KEY`, `BOT_PORT`
- [ ] Testar webhook com ngrok (expor porta 3002 para Twilio)
- [ ] Cadastrar alunos em `bot/data/alunos.json`
- [ ] Instagram DM (opcional — ManyChat ou Meta API)

### Design com referências visuais
- [x] `tools/add-reference.js` — adiciona/lista/remove imagens de `references/`
- [x] `agents/design.js` — envia referências como image blocks na API

---

## 📁 ARQUIVOS MODIFICADOS POR ÚLTIMO (ordem cronológica)

| Arquivo | Última modificação |
|---------|-------------------|
| `.claude/settings.local.json` | 2026-03-17 (sessão atual) |
| `ui/index.html` | 2026-03-17 01:06 — última versão da UI pixel art |
| `ui/server.js` | 2026-03-17 01:03 — SSE + todas as rotas |
| `prompts/seo-linkedin-email-funil-ads.md` | 2026-03-17 00:18 |
| `main.js` | 2026-03-17 00:11 |
| `agents/design.js` | 2026-03-17 00:10 |
| `agents/anuncio.js` | 2026-03-17 00:09 |
| `agents/funil.js` | 2026-03-17 00:09 |
| `agents/email.js` | 2026-03-17 00:08 |
| `agents/linkedin.js` | 2026-03-17 00:03 |

---

## 🚀 COMO RODAR

```bash
# Instalar dependências
npm install

# Rodar todos os agentes via CLI
node main.js "inglês para entrevista offshore"

# Rodar agentes específicos
node main.js "phrasal verbs" --agents copy,posts,design

# Rodar o painel de revisão (UI)
npm run ui
# Acessa: http://localhost:3001
```

---

## VARIÁVEIS DE AMBIENTE (`.env`)
```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
```

---

## PRÓXIMA AÇÃO IMEDIATA
Bot Shelly — colocar em produção:
1. Adicionar variáveis no `.env`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `PIX_KEY`, `BOT_PORT=3002`
2. Rodar `npm run bot`
3. Expor com ngrok: `ngrok http 3002`
4. Configurar webhook no Twilio: `https://xxx.ngrok.io/webhook/whatsapp`
5. Cadastrar primeiro aluno em `bot/data/alunos.json`
