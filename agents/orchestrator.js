import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

const client = new Anthropic();
const OUTPUTS_DIR = path.resolve('outputs');
const PLANS_DIR  = path.resolve('outputs/plans');
const QUEUE_FILE = path.resolve('outputs/queue.json');
const PLAN_FILE  = path.resolve('outputs/plan.json'); // latest, kept for compat

async function collectHistory() {
  const history = [];

  if (!(await fs.pathExists(OUTPUTS_DIR))) return history;

  const entries = await fs.readdir(OUTPUTS_DIR);

  for (const entry of entries) {
    const entryPath = path.join(OUTPUTS_DIR, entry);
    const stat = await fs.stat(entryPath);

    // Pastas com datas (ex: 2026-03-17)
    if (stat.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry)) {
      const topicFolders = await fs.readdir(entryPath);

      for (const topicFolder of topicFolders) {
        const topicPath = path.join(entryPath, topicFolder);
        const topicStat = await fs.stat(topicPath);
        if (!topicStat.isDirectory()) continue;

        const files = await fs.readdir(topicPath);
        for (const file of files) {
          if (!file.endsWith('.md')) continue;
          const content = await fs.readFile(path.join(topicPath, file), 'utf-8');
          history.push({
            date: entry,
            topic: topicFolder,
            type: file.replace('.md', ''),
            preview: content.slice(0, 300),
          });
        }
      }
    }
  }

  return history;
}

async function loadQueue() {
  if (!(await fs.pathExists(QUEUE_FILE))) return [];
  return fs.readJson(QUEUE_FILE);
}

export async function runOrchestrator(lang = 'pt') {
  console.log(chalk.cyan('Iniciando Orchestrator...'));

  const [history, queue] = await Promise.all([collectHistory(), loadQueue()]);

  const published = queue.filter((p) => p.status === 'published');
  const pending = queue.filter((p) => p.status === 'pending');
  const today = new Date().toISOString().slice(0, 10);

  const contextSummary = `
## Histórico de conteúdo gerado (outputs/)

${
  history.length === 0
    ? 'Nenhum conteúdo gerado ainda.'
    : history
        .map((h) => `- [${h.date}] Tópico: "${h.topic}" | Tipo: ${h.type}\n  Preview: ${h.preview.replace(/\n/g, ' ')}`)
        .join('\n')
}

## Posts publicados

${
  published.length === 0
    ? 'Nenhum post publicado ainda.'
    : published
        .map((p) => `- [${p.publishedAt?.slice(0, 10)}] Plataforma: ${p.platform} | Agente: ${p.agent}\n  Preview: ${p.content.slice(0, 200)}`)
        .join('\n')
}

## Posts agendados (pendentes)

${
  pending.length === 0
    ? 'Nenhum post agendado.'
    : pending
        .map((p) => `- [${p.scheduledAt?.slice(0, 10)}] Plataforma: ${p.platform} | Agente: ${p.agent}`)
        .join('\n')
}

## Data atual: ${today}
`;

  const isEn = lang === 'en';

  const prompt = isEn
    ? `You are a social media content strategist.

${contextSummary}

Based on this complete history, respond in structured JSON:

1. What has been posted recently? Are there patterns or gaps?
2. What should be posted now or in the next few hours?
3. What is the ideal content plan for the next 7 days?

Return ONLY valid JSON with this structure (no markdown, no explanations outside the JSON):
{
  "analysis": "brief analysis of history and gaps",
  "immediate": {
    "platform": "linkedin | instagram",
    "theme": "suggested theme",
    "reason": "why now"
  },
  "plan": [
    {
      "day": "YYYY-MM-DD",
      "platform": "linkedin | instagram",
      "theme": "content theme",
      "format": "post | carousel | video | story",
      "notes": "optional notes"
    }
  ]
}`
    : `Você é um estrategista de conteúdo para redes sociais.

${contextSummary}

Com base nesse histórico completo, responda em JSON estruturado:

1. O que foi postado recentemente? Há padrões ou lacunas?
2. O que deve ser postado agora ou nas próximas horas?
3. Qual o plano de conteúdo ideal para os próximos 7 dias?

Retorne APENAS um JSON válido com esta estrutura (sem markdown, sem explicações fora do JSON):
{
  "analysis": "análise breve do histórico e lacunas",
  "immediate": {
    "platform": "linkedin | instagram",
    "theme": "tema sugerido",
    "reason": "por quê agora"
  },
  "plan": [
    {
      "day": "YYYY-MM-DD",
      "platform": "linkedin | instagram",
      "theme": "tema do conteúdo",
      "format": "post | carrossel | vídeo | story",
      "notes": "observações opcionais"
    }
  ]
}`;

  console.log(chalk.blue('→ Consultando Claude para gerar plano de conteúdo...'));

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  let plan;
  try {
    // Remove possíveis blocos markdown se Claude incluir
    const jsonStr = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    plan = JSON.parse(jsonStr);
  } catch {
    console.error(chalk.red('Resposta do Claude não é JSON válido:'), raw.slice(0, 200));
    throw new Error('Claude retornou resposta inválida');
  }

  plan.generatedAt = new Date().toISOString();
  plan.basedOnHistory = history.length;
  plan.basedOnQueue = queue.length;

  await fs.ensureDir(OUTPUTS_DIR);
  await fs.ensureDir(PLANS_DIR);
  // save as timestamped file
  const planId   = 'plan-' + plan.generatedAt.replace(/[:.]/g, '-').replace('T','-').slice(0,19);
  const planPath = path.join(PLANS_DIR, planId + '.json');
  await fs.writeJson(planPath, { ...plan, id: planId }, { spaces: 2 });
  // keep plan.json as latest for backward compat
  await fs.writeJson(PLAN_FILE, { ...plan, id: planId }, { spaces: 2 });

  console.log(chalk.green(`✓ Plano salvo em outputs/plan.json`));
  console.log(chalk.white('\nAnálise: ') + chalk.gray(plan.analysis));
  console.log(chalk.white('Ação imediata: ') + chalk.yellow(`${plan.immediate?.platform} — ${plan.immediate?.theme}`));
  console.log(chalk.white(`Plano gerado para ${plan.plan?.length} dias.\n`));

  return plan;
}

// CLI entry point
const isMain = process.argv[1]?.includes('orchestrator.js');
if (isMain) {
  runOrchestrator().catch((err) => {
    console.error(chalk.red('Erro:'), err.message);
    process.exit(1);
  });
}
