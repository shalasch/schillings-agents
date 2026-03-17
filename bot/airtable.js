/**
 * bot/airtable.js
 * Acesso ao Airtable da Schilling's via REST API (fetch nativo Node 18+).
 *
 * Variáveis de ambiente (.env):
 *   AIRTABLE_API_KEY  — Personal Access Token gerado em airtable.com/create/tokens
 *   AIRTABLE_BASE_ID  — ID da base (começa com "app", ex: appXXXXXXXXXXXXXX)
 *
 * Tabela atual:
 *   "MATRÍCULA SCHILLING'S - Respostas ao formulário 1"
 *   Campos: "Nome completo" | "Telefone" | "Endereço de e-mail" | "Curso desejado"
 *
 * Tabelas futuras (funções já criadas, retornam [] até existirem):
 *   "Horarios"  — aulas agendadas
 *   Campo "Vencimento" na tabela de alunos — cobranças
 */

import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.AIRTABLE_API_KEY ?? '';
const BASE_ID = process.env.AIRTABLE_BASE_ID ?? '';

// ── nomes de tabelas e campos ─────────────────────────────────────────────────
// Centraliza aqui: quando novos campos/tabelas chegarem, só atualiza estas constantes.

const TABELA_ALUNOS    = "MATRÍCULA SCHILLING'S - Respostas ao formulário 1";
const CAMPO_NOME       = 'Nome completo';
const CAMPO_TELEFONE   = 'Telefone';
const CAMPO_EMAIL      = 'Endereço de e-mail';
const CAMPO_CURSO      = 'Curso desejado';

// Futuras (descomente e preencha quando as tabelas/campos forem criados)
// const TABELA_HORARIOS  = 'Horarios';
// const CAMPO_VENCIMENTO = 'Vencimento';

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Normaliza um número de telefone: remove +55, código de país, espaços e traços.
 * Exemplos:
 *   "+55 21 99999-9999" → "21999999999"
 *   "(21) 99999-9999"   → "21999999999"
 *   "5521999999999"     → "21999999999"
 */
function normalizeTel(tel) {
  return String(tel ?? '')
    .replace(/^\+?55/, '')   // remove prefixo +55 ou 55
    .replace(/\D/g, '');     // remove tudo que não é dígito
}

/**
 * Faz GET na API do Airtable e retorna todos os registros de uma tabela,
 * paginando automaticamente via offset.
 */
async function fetchRecords(tabela, params = {}) {
  if (!API_KEY || !BASE_ID) {
    console.warn('[airtable] AIRTABLE_API_KEY ou AIRTABLE_BASE_ID não configurados.');
    return [];
  }

  const headers = { Authorization: `Bearer ${API_KEY}` };
  const baseUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tabela)}`;
  const records = [];
  let offset    = undefined;

  do {
    const url = new URL(baseUrl);
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) v.forEach(vi => url.searchParams.append(k, vi));
      else url.searchParams.set(k, String(v));
    }
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable ${res.status}: ${body}`);
    }

    const data = await res.json();
    records.push(...(data.records ?? []));
    offset = data.offset; // undefined quando não há mais páginas
  } while (offset);

  return records;
}

// ── getAlunos ─────────────────────────────────────────────────────────────────

/**
 * Retorna todos os alunos com nome e telefone.
 * @returns {Promise<{ id: string, nome: string, telefone: string, email: string, curso: string }[]>}
 */
export async function getAlunos() {
  const records = await fetchRecords(TABELA_ALUNOS, {
    'fields[]': [CAMPO_NOME, CAMPO_TELEFONE, CAMPO_EMAIL, CAMPO_CURSO],
  });

  return records.map(r => ({
    id:       r.id,
    nome:     r.fields[CAMPO_NOME]     ?? '',
    telefone: r.fields[CAMPO_TELEFONE] ?? '',
    email:    r.fields[CAMPO_EMAIL]    ?? '',
    curso:    r.fields[CAMPO_CURSO]    ?? '',
  }));
}

// ── getAlunoByTelefone ────────────────────────────────────────────────────────

/**
 * Busca um aluno pelo telefone, normalizando o formato de ambos os lados.
 * @param {string} tel
 * @returns {Promise<object|null>}
 */
export async function getAlunoByTelefone(tel) {
  const busca  = normalizeTel(tel);
  const alunos = await getAlunos();
  return alunos.find(a => normalizeTel(a.telefone) === busca) ?? null;
}

// ── getAulas ──────────────────────────────────────────────────────────────────

/**
 * Retorna aulas de uma data específica (YYYY-MM-DD).
 * TODO: implementar quando a tabela "Horarios" for criada no Airtable.
 *       Atualizar TABELA_HORARIOS e os campos correspondentes acima.
 * @param {string} _data — YYYY-MM-DD
 * @returns {Promise<object[]>}
 */
export async function getAulas(_data) {
  return [];
}

// ── getVencimentos ────────────────────────────────────────────────────────────

/**
 * Retorna alunos com vencimento em uma data específica (YYYY-MM-DD).
 * TODO: implementar quando o campo "Vencimento" for adicionado à tabela de alunos.
 *       Atualizar CAMPO_VENCIMENTO acima e descomentar o filtro abaixo.
 * @param {string} _data — YYYY-MM-DD
 * @returns {Promise<object[]>}
 */
export async function getVencimentos(_data) {
  return [];
}
