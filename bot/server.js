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

import { receiveMessage, sendMessage, resolveContactJid } from './whatsapp.js';
import { reply }                                    from './shelly.js';
import { getConversa, saveConversa, listConversas } from './db.js';
import './cron.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.BOT_PORT ?? 3002;

// Parse JSON mesmo que Content-Type venha errado (tunnels como Cloudflare às vezes mandam text/plain)
app.use((req, res, next) => {
  express.json({ type: '*/*' })(req, res, (err) => {
    if (err) {
      // Tenta parse manual se express.json falhar
      let raw = '';
      req.on('data', chunk => { raw += chunk; });
      req.on('end', () => {
        try { req.body = JSON.parse(raw); } catch { req.body = {}; }
        next();
      });
    } else {
      next();
    }
  });
});

// ── GET /webhook — verificação de tunnel (ngrok/cloudflare fazem probe GET) ──

app.get('/webhook', (req, res) => {
  res.status(200).send('OK');
});

// ── POST /webhook ─────────────────────────────────────────────────────────────

app.post('/webhook', async (req, res) => {
  // Responde 200 imediatamente para a Evolution API não reenviar
  res.sendStatus(200);

  console.log(`[webhook] POST recebido — Content-Type: ${req.headers['content-type'] ?? 'n/a'}`);

  const parsed = receiveMessage(req);
  if (!parsed) return; // evento ignorado (fromMe, não-mensagem, tipo errado, etc.)

  const { de: deRaw, jid, pushName, mensagem } = parsed;
  console.log(`[webhook] ← ${deRaw} (${jid}): ${mensagem.slice(0, 80)}`);

  try {
    // Resolve @lid para JID real antes de tudo, para usar o número real no Airtable
    let destJid = jid;
    if (jid.endsWith('@lid')) {
      destJid = await resolveContactJid(jid, pushName);
      if (!destJid) {
        const fallback = process.env.FALLBACK_JID;
        if (fallback) {
          console.warn(`[webhook] @lid não resolvido — usando FALLBACK_JID: ${fallback}`);
          destJid = fallback;
        } else {
          console.warn(`[webhook] @lid não resolvido — mensagem ignorada para ${jid}`);
          return;
        }
      }
    }

    // Usa o número do JID resolvido para histórico e lookup no Airtable
    const de = destJid.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '') || deRaw;

    const { mensagens } = await getConversa(de);

    const resposta = await reply({ de, mensagem, historico: mensagens });

    await saveConversa(de, [
      ...mensagens,
      { role: 'user',      content: mensagem, ts: new Date().toISOString() },
      { role: 'assistant', content: resposta, ts: new Date().toISOString() },
    ]);

    console.log(`[webhook] → ${destJid}: ${resposta.slice(0, 80)}`);
    await sendMessage(destJid, resposta);

  } catch (err) {
    console.error('[webhook] erro ao processar mensagem:', err.message);
    console.error(err.stack);
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
