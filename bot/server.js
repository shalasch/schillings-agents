/**
 * bot/server.js
 * Servidor da Shelly — webhook Evolution API + painel de logs.
 *
 * Rotas:
 *   POST /webhook        — recebe evento da Evolution API, processa com Shelly, responde
 *   GET  /logs           — painel HTML de conversas (bot/logs.html)
 *   GET  /api/conversas  — lista resumo de conversas (JSON)
 *   GET  /api/conversa/:whatsapp — histórico completo (JSON)
 *
 * Iniciar: npm run bot   (node bot/server.js)
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

import { receiveMessage, sendMessage }              from './whatsapp.js';
import { reply }                                    from './shelly.js';
import { getConversa, saveConversa, listConversas } from './db.js';
import './cron.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.BOT_PORT ?? 3002;

app.use(express.json());

// ── POST /webhook ─────────────────────────────────────────────────────────────

app.post('/webhook', async (req, res) => {
  // Responde 200 imediatamente para a Evolution API não reenviar
  res.sendStatus(200);

  const parsed = receiveMessage(req);
  if (!parsed) return; // evento ignorado (fromMe, não-mensagem, etc.)

  const { de, mensagem } = parsed;
  console.log(`[webhook] ← ${de}: ${mensagem.slice(0, 80)}`);

  try {
    const { mensagens } = await getConversa(de);

    const resposta = await reply({ de, mensagem, historico: mensagens });
    console.log(`[webhook] → ${de}: ${resposta.slice(0, 80)}`);

    await saveConversa(de, [
      ...mensagens,
      { role: 'user',      content: mensagem, ts: new Date().toISOString() },
      { role: 'assistant', content: resposta, ts: new Date().toISOString() },
    ]);

    await sendMessage(de, resposta);

  } catch (err) {
    console.error('[webhook] erro:', err.message);
  }
});

// ── GET /api/conversas ────────────────────────────────────────────────────────

app.get('/api/conversas', async (req, res) => {
  try {
    res.json(await listConversas());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/conversa/:whatsapp ───────────────────────────────────────────────

app.get('/api/conversa/:whatsapp', async (req, res) => {
  try {
    res.json(await getConversa(req.params.whatsapp));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /logs ─────────────────────────────────────────────────────────────────

app.get('/logs', (req, res) => {
  res.sendFile(path.join(__dirname, 'logs.html'));
});

app.get('/', (req, res) => res.redirect('/logs'));

// ── start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🤖 Shelly rodando na porta ${PORT}`);
  console.log(`   Logs:    http://localhost:${PORT}/logs`);
  console.log(`   Webhook: POST http://localhost:${PORT}/webhook\n`);
});
