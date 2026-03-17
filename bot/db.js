/**
 * bot/db.js
 * Persistência JSON simples em bot/data/
 *
 * Arquivos:
 *   bot/data/alunos.json   — cadastro de alunos
 *   bot/data/aulas.json    — agenda de aulas
 *   bot/data/conversas/    — uma pasta por número (whatsapp.json)
 *
 * Estrutura alunos.json:
 * [{ whatsapp, nome, plano, vencimento (YYYY-MM-DD), valor, linkAula, statusPagamento }]
 *
 * Estrutura aulas.json:
 * [{ whatsapp, nomeAluno, data (YYYY-MM-DD), hora (HH:MM), link, status }]
 *
 * Estrutura conversas/5521999.json:
 * [{ role: 'user'|'assistant', content, ts }]
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.join(__dirname, 'data');
const CONV_DIR  = path.join(DATA_DIR, 'conversas');

await fs.ensureDir(DATA_DIR);
await fs.ensureDir(CONV_DIR);

// ── utils ─────────────────────────────────────────────────────────────────────

function normalize(whatsapp) {
  return String(whatsapp).replace(/\D/g, '');
}

async function readJson(file, fallback = []) {
  try {
    if (await fs.pathExists(file)) return await fs.readJson(file);
  } catch (_) {}
  return fallback;
}

// ── alunos ────────────────────────────────────────────────────────────────────

/**
 * Retorna o cadastro de um aluno pelo número do WhatsApp.
 * @param {string} whatsapp
 * @returns {object|null}
 */
export async function getAluno(whatsapp) {
  const alunos = await readJson(path.join(DATA_DIR, 'alunos.json'));
  return alunos.find(a => normalize(a.whatsapp) === normalize(whatsapp)) ?? null;
}

// ── aulas ─────────────────────────────────────────────────────────────────────

/**
 * Retorna todas as aulas de uma data específica (YYYY-MM-DD).
 * @param {string} data
 * @returns {object[]}
 */
export async function getAulas(data) {
  const aulas = await readJson(path.join(DATA_DIR, 'aulas.json'));
  return aulas.filter(a => a.data === data && a.status !== 'cancelada');
}

// ── vencimentos ───────────────────────────────────────────────────────────────

/**
 * Retorna alunos cujo vencimento é igual à data fornecida (YYYY-MM-DD).
 * @param {string} data
 * @returns {object[]}
 */
export async function getVencimentos(data) {
  const alunos = await readJson(path.join(DATA_DIR, 'alunos.json'));
  return alunos.filter(a => a.vencimento === data && a.statusPagamento !== 'pago');
}

// ── conversas ─────────────────────────────────────────────────────────────────

function convPath(whatsapp) {
  return path.join(CONV_DIR, `${normalize(whatsapp)}.json`);
}

/**
 * Retorna o histórico completo de uma conversa.
 * @param {string} whatsapp
 * @returns {{ whatsapp: string, mensagens: object[] }}
 */
export async function getConversa(whatsapp) {
  const file = convPath(whatsapp);
  const mensagens = await readJson(file, []);
  return { whatsapp: normalize(whatsapp), mensagens };
}

/**
 * Salva (substitui) o array de mensagens de uma conversa.
 * @param {string} whatsapp
 * @param {object[]} mensagens — array de { role, content, ts }
 */
export async function saveConversa(whatsapp, mensagens) {
  await fs.writeJson(convPath(whatsapp), mensagens, { spaces: 2 });
}

/**
 * Lista resumo de todas as conversas salvas.
 * @returns {object[]}
 */
export async function listConversas() {
  const files = (await fs.readdir(CONV_DIR).catch(() => []))
    .filter(f => f.endsWith('.json'));

  const result = [];
  for (const f of files) {
    const mensagens = await readJson(path.join(CONV_DIR, f), []);
    const phone = f.replace('.json', '');
    const last  = mensagens[mensagens.length - 1];
    result.push({
      whatsapp:     phone,
      total:        mensagens.length,
      ultimaMensagem: last?.content?.slice(0, 80) ?? '',
      ultimaAtividade: last?.ts ?? null,
    });
  }

  return result.sort((a, b) =>
    (b.ultimaAtividade ?? '').localeCompare(a.ultimaAtividade ?? ''));
}
