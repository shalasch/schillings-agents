/**
 * bot/shelly.js
 * Cérebro da Shelly — chama Claude com o system prompt da secretaria.
 *
 * Exporta:
 *   reply({ de, mensagem, historico }) → string
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAluno } from './db.js';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_FILE = path.resolve(__dirname, '..', 'prompts', 'secretaria-bot.md');

const client = new Anthropic();

// ── system prompt ─────────────────────────────────────────────────────────────

async function buildSystemPrompt(de) {
  const base = await fs.readFile(PROMPT_FILE, 'utf-8').catch(() =>
    'Você é Shelly, assistente virtual da Schillings English Course. Seja simpática e profissional.'
  );

  // Contexto do aluno (se cadastrado)
  const aluno = await getAluno(de);
  let contexto = '';
  if (aluno) {
    contexto = `

---
## CONTEXTO DO CONTATO ATUAL
- Nome: ${aluno.nome}
- Plano: ${aluno.plano ?? 'não informado'}
- Vencimento: ${aluno.vencimento ?? 'não informado'}
- Status de pagamento: ${aluno.statusPagamento ?? 'não informado'}
- É aluno cadastrado: SIM
`;
  } else {
    contexto = `

---
## CONTEXTO DO CONTATO ATUAL
- É aluno cadastrado: NÃO (possível novo contato ou lead)
`;
  }

  return base + contexto;
}

// ── reply ─────────────────────────────────────────────────────────────────────

/**
 * Processa uma mensagem e retorna a resposta da Shelly.
 *
 * @param {{ de: string, mensagem: string, historico: {role:string, content:string}[] }} param
 * @returns {Promise<string>}
 */
export async function reply({ de, mensagem, historico }) {
  const system = await buildSystemPrompt(de);

  // Últimas 5 mensagens do histórico + mensagem atual
  const ultimas = (historico ?? []).slice(-5);
  const messages = [
    ...ultimas.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: mensagem },
  ];

  const response = await client.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 500,
    system,
    messages,
  });

  return response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();
}
