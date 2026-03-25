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

// Tipos de mensagem de texto aceitos
const TEXT_TYPES = new Set(['conversation', 'extendedTextMessage', 'ephemeralMessage']);

// ── resolveContactJid ─────────────────────────────────────────────────────────

/**
 * Tenta resolver um @lid para um JID real buscando no banco interno da Evolution API.
 * Estratégias em cascata:
 *   1. POST /contact/findContacts — busca contato pelo id/@lid
 *   2. POST /chat/findChats       — busca chat pelo id/@lid (pode ter participant real)
 *   3. POST /chat/findMessages    — varre mensagens da conversa em busca de @s.whatsapp.net
 *
 * Nota: body.sender é o número da própria instância (bot), não do contato.
 * whatsappNumbers não é usado pois sempre devolve o @lid de volta.
 *
 * @param {string} rawJid    — ex: "41489518309439@lid"
 * @param {string|null} pushName — nome exibido (fallback em findContacts)
 * @returns {Promise<string|null>} — JID real (@s.whatsapp.net) ou null se não resolvido
 */
export async function resolveContactJid(rawJid, pushName) {
  if (!API_KEY) {
    console.warn(`[whatsapp] EVOLUTION_API_KEY ausente — não é possível resolver ${rawJid}`);
    return null;
  }

  const headers = { 'Content-Type': 'application/json', apikey: API_KEY };

  // Auxiliar: checa se um valor é um JID real (@s.whatsapp.net)
  const isRealJid = v => v && typeof v === 'string' && v.endsWith('@s.whatsapp.net');

  // 1. POST /contact/findContacts — pesquisa no banco interno pelo id = @lid
  for (const where of [{ id: rawJid }, { pushName }].filter(w => Object.values(w)[0])) {
    try {
      const res = await fetch(`${BASE_URL}/contact/findContacts/${INSTANCE}`, {
        method:  'POST',
        headers,
        body:    JSON.stringify({ where }),
      });
      if (res.ok) {
        const data = await res.json();
        const contacts = Array.isArray(data) ? data : (data?.contacts ?? []);
        const match = contacts.find(c => isRealJid(c.id) || isRealJid(c.remoteJid));
        if (match) {
          const jid = match.id ?? match.remoteJid;
          console.log(`[whatsapp] @lid resolvido via findContacts (${JSON.stringify(where)}): ${rawJid} → ${jid}`);
          return jid;
        }
        console.log(`[whatsapp] findContacts (${JSON.stringify(where)}): ${contacts.length} contatos, nenhum com @s.whatsapp.net`);
      } else {
        console.log(`[whatsapp] findContacts: ${res.status}`);
      }
    } catch (err) {
      console.warn(`[whatsapp] findContacts erro: ${err.message}`);
    }
  }

  // 2. POST /chat/findChats — busca o objeto de chat pelo @lid, que pode ter o JID real
  try {
    const res = await fetch(`${BASE_URL}/chat/findChats/${INSTANCE}`, {
      method:  'POST',
      headers,
      body:    JSON.stringify({ where: { id: rawJid } }),
    });
    if (res.ok) {
      const data = await res.json();
      const chats = Array.isArray(data) ? data : (data?.chats ?? []);
      console.log(`[whatsapp] findChats retornou ${chats.length} chats para ${rawJid}`);
      for (const chat of chats) {
        const candidates = [chat.id, chat.remoteJid, chat.jid, ...(chat.participants ?? [])];
        const jid = candidates.find(isRealJid);
        if (jid) {
          console.log(`[whatsapp] @lid resolvido via findChats: ${rawJid} → ${jid}`);
          return jid;
        }
      }
    } else {
      console.log(`[whatsapp] findChats: ${res.status}`);
    }
  } catch (err) {
    console.warn(`[whatsapp] findChats erro: ${err.message}`);
  }

  // 3. POST /chat/findMessages — varre mensagens da conversa em busca de JID real
  try {
    const res = await fetch(`${BASE_URL}/chat/findMessages/${INSTANCE}`, {
      method:  'POST',
      headers,
      body:    JSON.stringify({ where: { key: { remoteJid: rawJid } } }),
    });
    if (res.ok) {
      const data = await res.json();
      const msgs = Array.isArray(data) ? data : (data?.messages ?? data?.records ?? []);
      console.log(`[whatsapp] findMessages retornou ${msgs.length} mensagens para ${rawJid}`);
      // Ignora mensagens enviadas pelo próprio bot (fromMe=true) — elas têm o JID do bot,
      // não do contato. Procura só em mensagens recebidas (fromMe=false).
      for (const m of msgs.filter(m => m?.key?.fromMe === false)) {
        const candidates = [m?.key?.participant, m?.participant, m?.sender];
        const jid = candidates.find(isRealJid);
        if (jid) {
          console.log(`[whatsapp] @lid resolvido via findMessages: ${rawJid} → ${jid}`);
          return jid;
        }
      }
      console.log(`[whatsapp] findMessages: nenhuma mensagem recebida com @s.whatsapp.net`);
    } else {
      console.log(`[whatsapp] findMessages: ${res.status}`);
    }
  } catch (err) {
    console.warn(`[whatsapp] findMessages erro: ${err.message}`);
  }

  console.warn(`[whatsapp] não foi possível resolver ${rawJid} — nenhuma estratégia funcionou`);
  return null;
}

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

  const numero = String(para);
  const url    = `${BASE_URL}/message/sendText/${INSTANCE}`;

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', apikey: API_KEY },
    body:    JSON.stringify({ number: numero, textMessage: { text: mensagem } }),
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
 * Suporta Evolution API v1.x (data como array) e v2.x (data como objeto).
 *
 * Formatos suportados:
 *   v2.x: { event, instance, data: { key, message, messageType, ... } }
 *   v1.x: { event, instance, data: [{ key, message, ... }] }
 *
 * @param {import('express').Request} req
 * @returns {{ de: string, mensagem: string } | null}
 */
export function receiveMessage(req) {
  let body = req.body;

  // Fallback: se body veio como string (Content-Type errado pelo tunnel)
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  // Log completo do payload recebido para debug
  const event = body?.event ?? '(sem event)';
  console.log(`[whatsapp] payload recebido — event: "${event}" instance: "${body?.instance ?? '?'}"`);
  if (process.env.WEBHOOK_DEBUG === 'true') {
    console.log('[whatsapp] body completo:', JSON.stringify(body, null, 2));
  }

  // Aceita tanto "messages.upsert" quanto "MESSAGES_UPSERT" (variação entre versões)
  if (!event.toLowerCase().includes('messages') || !event.toLowerCase().includes('upsert')) {
    console.log(`[whatsapp] evento ignorado: ${event}`);
    return null;
  }

  // Evolution API v1.x envia data como array; v2.x envia como objeto
  const rawData = body?.data;
  if (!rawData) { console.log('[whatsapp] body.data ausente'); return null; }

  const entry = Array.isArray(rawData) ? rawData[0] : rawData;
  if (!entry) { console.log('[whatsapp] entry vazia'); return null; }

  // Ignora mensagens enviadas pelo próprio bot
  if (entry.key?.fromMe === true) {
    console.log('[whatsapp] ignorado: fromMe=true');
    return null;
  }

  // Ignora tipos não-texto (imagem, áudio, sticker, etc.)
  const msgType = entry.messageType ?? Object.keys(entry.message ?? {})[0] ?? '';
  if (msgType && !TEXT_TYPES.has(msgType)) {
    console.log(`[whatsapp] ignorado: tipo não-texto "${msgType}"`);
    return null;
  }

  const jid = entry.key?.remoteJid ?? '';

  if (jid.endsWith('@lid')) {
    console.log(`[whatsapp] @lid detectado — resolução pendente (${jid})`);
  }

  // de = chave interna de conversa (somente dígitos, funciona para qualquer formato de JID)
  const de = jid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '').replace(/@lid$/, '').replace(/\D/g, '');
  if (!de) { console.log('[whatsapp] JID inválido:', destJid); return null; }

  // Filtro de modo teste — ignora mensagens de números não autorizados
  const NUMEROS_TESTE = process.env.TEST_NUMBERS ? process.env.TEST_NUMBERS.split(',') : [];
  const MODO_TESTE = process.env.TEST_MODE === 'true';
  if (MODO_TESTE && !NUMEROS_TESTE.some(n => de.includes(n.trim()))) {
    console.log(`[TESTE] Mensagem ignorada de ${de}`);
    return null;
  }

  // Extrai texto da mensagem (suporta conversation, extendedTextMessage e ephemeralMessage)
  const msg = entry.message ?? {};
  const mensagem = (
    msg.conversation ??
    msg.extendedTextMessage?.text ??
    msg.ephemeralMessage?.message?.extendedTextMessage?.text ??
    ''
  ).trim();

  if (!mensagem) {
    console.log('[whatsapp] mensagem vazia — tipo:', msgType, '| keys:', Object.keys(msg));
    return null;
  }

  console.log(`[whatsapp] mensagem extraida de ${de}: "${mensagem.slice(0, 60)}"`);
  return { de, jid, pushName: entry.pushName ?? null, mensagem };
}
