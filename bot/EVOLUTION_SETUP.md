# Evolution API — Setup

## 1. Instalar Docker

Baixe e instale o Docker Desktop:
https://www.docker.com/products/docker-desktop

Verifique a instalação:
```bash
docker --version
```

---

## 2. Subir a Evolution API

```bash
docker run -d \
  --name evolution-api \
  --restart always \
  -p 8080:8080 \
  atendai/evolution-api:latest
```

Confirme que está rodando:
```bash
docker ps
```

Acesse o painel: http://localhost:8080

---

## 3. Criar a instância "schillings"

No painel em http://localhost:8080, crie uma nova instância com o nome **schillings**.

Ou via API:
```bash
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_GLOBAL_API_KEY" \
  -d '{ "instanceName": "schillings", "qrcode": true }'
```

---

## 4. Escanear o QR Code

No painel, clique na instância **schillings** e escaneie o QR Code com o WhatsApp do número da Schilling's (Settings > Linked Devices > Link a Device).

Aguarde o status mudar para **open** (conectado).

---

## 5. Pegar a API Key e configurar o .env

Copie a API Key exibida no painel e adicione ao `.env`:

```env
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua-api-key-aqui
EVOLUTION_INSTANCE=schillings
```

---

## 6. Configurar o Webhook

Na Evolution API, configure o webhook para apontar para o bot.

Se estiver rodando localmente, use o ngrok para expor a porta 3002:
```bash
npx ngrok http 3002
```

Copie a URL gerada (ex: `https://abc123.ngrok.io`) e configure no painel da Evolution API:

- **Webhook URL:** `https://abc123.ngrok.io/webhook`
- **Eventos:** marque `messages.upsert`

---

## 7. Rodar o bot

```bash
npm run bot
```

Saída esperada:
```
[cron] Jobs ativos: 08:00 (aulas do dia) · 18:00 (véspera) · 09:00 (cobranças)

🤖 Shelly rodando na porta 3002
   Logs:    http://localhost:3002/logs
   Webhook: POST http://localhost:3002/webhook
```

---

## Estrutura de dados esperada

Crie os arquivos JSON em `bot/data/` antes de rodar:

**bot/data/alunos.json**
```json
[
  {
    "whatsapp": "5521999999999",
    "nome": "João Silva",
    "plano": "Mensal 8 aulas",
    "vencimento": "2026-04-05",
    "valor": "350",
    "linkAula": "https://zoom.us/j/...",
    "statusPagamento": "pendente"
  }
]
```

**bot/data/aulas.json**
```json
[
  {
    "whatsapp": "5521999999999",
    "nomeAluno": "João Silva",
    "data": "2026-03-18",
    "hora": "10:00",
    "link": "https://zoom.us/j/...",
    "status": "confirmada"
  }
]
```
