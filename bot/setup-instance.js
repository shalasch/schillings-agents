/**
 * bot/setup-instance.js
 * Cria a instância no Evolution API, exibe o QR code no terminal e
 * aguarda a conexão do WhatsApp.
 *
 * Uso: node bot/setup-instance.js
 */

import dotenv from 'dotenv';
import QRCode from 'qrcode';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QR_PATH   = path.join(__dirname, 'qrcode.png');

const BASE_URL = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080';
const API_KEY  = process.env.EVOLUTION_API_KEY  ?? '';
const INSTANCE = process.env.EVOLUTION_INSTANCE ?? 'schillings';
const HEADERS  = { 'Content-Type': 'application/json', apikey: API_KEY };

// ── helpers ───────────────────────────────────────────────────────────────────

function log(msg)   { console.log(`\n${msg}`); }
function ok(msg)    { console.log(`\x1b[32m✓ ${msg}\x1b[0m`); }
function info(msg)  { console.log(`\x1b[36m▸ ${msg}\x1b[0m`); }
function warn(msg)  { console.log(`\x1b[33m⚠ ${msg}\x1b[0m`); }
function fail(msg)  { console.error(`\x1b[31m✗ ${msg}\x1b[0m`); }

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── steps ─────────────────────────────────────────────────────────────────────

async function checkServer() {
  info(`Verificando Evolution API em ${BASE_URL}...`);
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(5000) });
    if (res.ok || res.status < 500) { ok('Evolution API acessível.'); return; }
    throw new Error(`status ${res.status}`);
  } catch (e) {
    fail(`Não foi possível acessar ${BASE_URL}: ${e.message}`);
    log('Certifique-se de que o Docker está rodando e a Evolution API foi iniciada.');
    log('Consulte bot/EVOLUTION_SETUP.md — passo 2.');
    process.exit(1);
  }
}

async function createInstance() {
  info(`Criando instância "${INSTANCE}"...`);

  const { ok: success, status, data } = await api('POST', '/instance/create', {
    instanceName: INSTANCE,
    qrcode:       true,
    integration:  'WHATSAPP-BAILEYS',
  });

  if (success) {
    ok(`Instância "${INSTANCE}" criada.`);
    return;
  }

  // 409 = já existe — tudo bem, continua
  if (status === 409 || JSON.stringify(data).toLowerCase().includes('already')) {
    warn(`Instância "${INSTANCE}" já existe — seguindo para conexão.`);
    return;
  }

  fail(`Erro ao criar instância: ${status} ${JSON.stringify(data)}`);
  process.exit(1);
}

async function fetchQR() {
  info('Buscando QR code...');

  // Tenta até 5x (a instância pode demorar segundos para ficar pronta)
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { ok: success, data } = await api('GET', `/instance/connect/${INSTANCE}`);

    if (success && data.code) return data.code;
    if (success && data.base64) {
      // Extrai o dado puro do QR a partir do base64 PNG não é direto —
      // neste caso retorna o base64 para renderização alternativa
      return { base64: data.base64 };
    }

    warn(`Tentativa ${attempt}/5 — instância ainda inicializando...`);
    await sleep(2000);
  }

  fail('Não foi possível obter o QR code.');
  log('A instância pode já estar conectada. Verifique o painel em ' + BASE_URL);
  process.exit(1);
}

async function renderQR(code) {
  const rawCode = typeof code === 'object' ? code.base64 : code;

  await QRCode.toFile(QR_PATH, rawCode, { width: 400 });
  ok(`QR code salvo em ${QR_PATH}`);
  info('Escaneie com o WhatsApp da Schilling\'s > Aparelhos conectados > Conectar um aparelho');
  exec(`start "" "${QR_PATH}"`);
}

async function waitForConnection() {
  info('Aguardando conexão (escaneie o QR code)...');

  const MAX_WAIT = 120; // segundos
  const INTERVAL = 3;

  for (let elapsed = 0; elapsed < MAX_WAIT; elapsed += INTERVAL) {
    await sleep(INTERVAL * 1000);

    const { ok: success, data } = await api('GET', `/instance/connectionState/${INSTANCE}`);

    if (!success) continue;

    const state = data?.instance?.state ?? data?.state ?? '';

    if (state === 'open') {
      log('');
      ok('WhatsApp conectado com sucesso!');
      ok(`Instância "${INSTANCE}" está ativa.`);
      log('Próximos passos:');
      info('1. Configure o webhook no painel: POST /webhook apontando para seu servidor');
      info('2. Rode o bot: npm run bot');
      info('3. Consulte bot/EVOLUTION_SETUP.md — passo 6 para configurar o ngrok');
      return;
    }

    process.stdout.write(`\r\x1b[36m▸ Aguardando... ${elapsed + INTERVAL}s / ${MAX_WAIT}s  (estado: ${state || '?'})\x1b[0m`);
  }

  log('');
  warn(`Timeout de ${MAX_WAIT}s atingido sem conexão.`);
  warn('O QR code pode ter expirado. Rode o script novamente.');
  process.exit(1);
}

// ── main ──────────────────────────────────────────────────────────────────────

if (!API_KEY) {
  fail('EVOLUTION_API_KEY não definida no .env');
  process.exit(1);
}

log(`\x1b[33m━━━ Evolution API Setup — instância: ${INSTANCE} ━━━\x1b[0m`);

await checkServer();
await createInstance();
const code = await fetchQR();
await renderQR(code);
await waitForConnection();
