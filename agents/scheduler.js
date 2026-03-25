import fs from 'fs-extra';
import path from 'path';
import cron from 'node-cron';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { publishLinkedIn, publishInstagram } from './publisher.js';

dotenv.config();

const QUEUE_FILE = path.resolve('outputs/queue.json');

async function loadQueue() {
  await fs.ensureDir(path.resolve('outputs'));
  if (!(await fs.pathExists(QUEUE_FILE))) {
    await fs.writeJson(QUEUE_FILE, [], { spaces: 2 });
  }
  return fs.readJson(QUEUE_FILE);
}

async function saveQueue(queue) {
  await fs.writeJson(QUEUE_FILE, queue, { spaces: 2 });
}

export async function addToQueue(post) {
  const queue = await loadQueue();

  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    agent: post.agent || 'manual',
    content: post.content,
    platform: post.platform,
    scheduledAt: post.scheduledAt || new Date().toISOString(),
    status: 'pending',
    imagePath: post.imagePath || null,
    createdAt: new Date().toISOString(),
  };

  queue.push(item);
  await saveQueue(queue);

  console.log(chalk.green(`✓ Post adicionado à fila [${item.id}] → ${item.platform} @ ${item.scheduledAt}`));
  return item;
}

export async function processQueue() {
  const queue = await loadQueue();
  const now = new Date();
  let updated = false;

  for (const post of queue) {
    if (post.status !== 'pending') continue;

    const scheduledAt = new Date(post.scheduledAt);
    if (scheduledAt > now) continue;

    console.log(chalk.blue(`→ Processando post [${post.id}] para ${post.platform}...`));

    try {
      if (post.platform === 'linkedin') {
        await publishLinkedIn(post.content);
      } else if (post.platform === 'instagram') {
        await publishInstagram(post.content, post.imagePath);
      } else {
        throw new Error(`Plataforma desconhecida: ${post.platform}`);
      }

      post.status = 'published';
      post.publishedAt = new Date().toISOString();
      console.log(chalk.green(`✓ Post [${post.id}] publicado com sucesso`));
    } catch (err) {
      post.status = 'failed';
      post.error = err.message;
      console.error(chalk.red(`✗ Falha ao publicar [${post.id}]: ${err.message}`));
    }

    updated = true;
  }

  if (updated) await saveQueue(queue);
}

// Cron: roda a cada 5 minutos
cron.schedule('*/5 * * * *', async () => {
  console.log(chalk.gray(`[${new Date().toISOString()}] Verificando fila de posts...`));
  try {
    await processQueue();
  } catch (err) {
    console.error(chalk.red('Erro no processamento da fila:'), err.message);
  }
});

console.log(chalk.cyan('Scheduler iniciado — verificando fila a cada 5 minutos.'));

// CLI: adicionar post à fila manualmente
// node agents/scheduler.js add '{"platform":"linkedin","content":"Texto","scheduledAt":"2026-03-18T14:00:00Z"}'
const isMain = process.argv[1]?.includes('scheduler.js');
if (isMain && process.argv[2] === 'add') {
  try {
    const post = JSON.parse(process.argv[3]);
    addToQueue(post).then(() => process.exit(0));
  } catch {
    console.error(chalk.red('Uso: node agents/scheduler.js add \'{"platform":"linkedin","content":"...","scheduledAt":"ISO_DATE"}\''));
    process.exit(1);
  }
}
