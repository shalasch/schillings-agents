/**
 * bot/cron.js
 * Jobs automáticos da Shelly.
 *
 * Horários:
 *   08:00 — lembrete de aulas do dia para alunos
 *   18:00 — lembrete de aulas do dia seguinte para alunos
 *   09:00 — cobrança para alunos com vencimento no dia
 *
 * Variáveis de ambiente usadas:
 *   PIX_KEY — chave Pix exibida nas cobranças
 */

import cron from 'node-cron';
import { getAulas, getVencimentos } from './db.js';
import { sendMessage } from './whatsapp.js';

// ── utils ─────────────────────────────────────────────────────────────────────

function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const PIX = process.env.PIX_KEY ?? '(configurar PIX_KEY no .env)';

async function dispatch(whatsapp, mensagem, contexto) {
  try {
    await sendMessage(whatsapp, mensagem);
    console.log(`[cron] ✓ ${contexto} → ${whatsapp}`);
  } catch (e) {
    console.error(`[cron] ✗ ${contexto} → ${whatsapp}:`, e.message);
  }
}

// ── 08:00 — lembrete: aulas do dia ───────────────────────────────────────────

cron.schedule('0 8 * * *', async () => {
  console.log('[cron] 08:00 — lembretes de aula do dia');
  const aulas = await getAulas(dateStr(0));
  for (const aula of aulas) {
    const msg =
      `Olá ${aula.nomeAluno}! 👋\n` +
      `Lembrete da sua aula de inglês hoje às ${aula.hora} com a professora Cláudia.\n` +
      (aula.link ? `Acesse: ${aula.link}\n` : '') +
      `Alguma dúvida ou precisa reagendar? É só me falar! 😊`;
    await dispatch(aula.whatsapp, msg, 'lembrete do dia');
  }
});

// ── 18:00 — lembrete: aulas do dia seguinte ───────────────────────────────────

cron.schedule('0 18 * * *', async () => {
  console.log('[cron] 18:00 — lembretes véspera');
  const aulas = await getAulas(dateStr(1));
  for (const aula of aulas) {
    const msg =
      `Olá ${aula.nomeAluno}! 📚\n` +
      `Lembrete da sua aula de inglês amanhã (${formatDate(aula.data)}) às ${aula.hora} com a professora Cláudia.\n` +
      (aula.link ? `Link: ${aula.link}\n` : '') +
      `Precisa reagendar? Me avisa com antecedência! 😊`;
    await dispatch(aula.whatsapp, msg, 'lembrete véspera');
  }
});

// ── 09:00 — cobrança: vencimentos do dia ──────────────────────────────────────

cron.schedule('0 9 * * *', async () => {
  console.log('[cron] 09:00 — cobranças do dia');
  const vencimentos = await getVencimentos(dateStr(0));
  for (const aluno of vencimentos) {
    const msg =
      `Olá ${aluno.nome}! Tudo bem? 🙂\n` +
      `Passando para lembrar que hoje é o dia do seu pagamento referente a ${aluno.plano ?? 'seu plano'}.\n` +
      `Valor: R$ ${aluno.valor ?? '---'}\n` +
      `Pix: ${PIX}\n` +
      `Qualquer dúvida, estou aqui!`;
    await dispatch(aluno.whatsapp, msg, 'cobrança');
  }
});

console.log('[cron] Jobs ativos: 08:00 (aulas do dia) · 18:00 (véspera) · 09:00 (cobranças)');
