/**
 * bot/whatsapp.js
 * Integração Evolution API para envio e recebimento de mensagens WhatsApp.
 *
 * Variáveis de ambiente (.env):
 *   EVOLUTION_API_URL   — ex: http://localhost:8080
 *   EVOLUTION_API_KEY   — API key gerada na Evolution API
 *   EVOLUTION_INSTANCE  — nome da instância (ex: schillings)
 */

import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080';
const API_KEY  = process.env.EVOLUTION_API_KEY  ?? '';
const INSTANCE = process.env.EVOLUTION_INSTANCE ?? 'schillings';

// ── sendMessage ───────────────────────────────────────────────────────────────

/**
 * Envia uma mensagem de texto via Evolution API.
 * @param {string} para     — número destino, somente dígitos (ex: 5521999999999)
 * @param {string} mensagem — texto a enviar
 */
export async function sendMessage(para, mensagem) {
  if (!API_KEY) {
    console.warn('[whatsapp] EVOLUTION_API_KEY não configurada — mensagem NÃO enviada.');
    return;
  }

  const numero = String(para).replace(/\D/g, '');
  const url    = `${BASE_URL}/message/sendText/${INSTANCE}`;

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', apikey: API_KEY },
    body:    JSON.stringify({ number: numero, text: mensagem }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Evolution API: ${res.status} ${err}`);
  }

  console.log(`[whatsapp] ✓ enviado → ${numero}`);
}

// ── receiveMessage ────────────────────────────────────────────────────────────

/**
 * Extrai { de, mensagem } do payload de webhook da Evolution API.
 *
 * Formato esperado (event: messages.upsert):
 * {
 *   event: "messages.upsert",
 *   data: {
 *     key: { remoteJid: "5521999999999@s.whatsapp.net", fromMe: false },
 *     message: { conversation: "texto" | extendedTextMessage: { text: "texto" } }
 *   }
 * }
 *
 * @param {import('express').Request} req
 * @returns {{ de: string, mensagem: string } | null}
 */
export function receiveMessage(req) {
  const body = req.body;

  // Ignora eventos que não sejam mensagens recebidas
  if (body?.event !== 'messages.upsert') return null;

  const data = body?.data;
  if (!data) return null;

  // Ignora mensagens enviadas pelo próprio bot
  if (data.key?.fromMe === true) return null;

  // Extrai número limpo do remoteJid (ex: "5521999999999@s.whatsapp.net")
  const jid = data.key?.remoteJid ?? '';
  const de  = jid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace(/\D/g, '');
  if (!de) return null;

  // Extrai texto da mensagem (suporta conversation e extendedTextMessage)
  const msg     = data.message ?? {};
  const mensagem = (
    msg.conversation ??
    msg.extendedTextMessage?.text ??
    ''
  ).trim();

  if (!mensagem) return null;

  return { de, mensagem };
}
