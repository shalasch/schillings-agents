import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

const client = new Anthropic();

function toSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function todayFolder() {
  return new Date().toISOString().slice(0, 10);
}

export async function runPosts(topic) {
  const promptTemplate = await fs.readFile(
    path.resolve('prompts/posts.md'),
    'utf-8'
  );
  const prompt = promptTemplate.replace(/\{topic\}/g, topic);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const output = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  const slug = toSlug(topic);
  const outputDir = path.resolve('outputs', todayFolder(), slug);
  await fs.ensureDir(outputDir);
  await fs.writeFile(path.join(outputDir, 'posts.md'), output, 'utf-8');

  console.log(chalk.green(`✓ Posts gerados para "${topic}" → outputs/${todayFolder()}/${slug}/posts.md`));

  return output;
}

// CLI entry point
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain || process.argv[1]?.includes('posts.js')) {
  const topic = process.argv[2];
  if (!topic) {
    console.error(chalk.red('Uso: node agents/posts.js "tópico"'));
    process.exit(1);
  }
  runPosts(topic).catch((err) => {
    console.error(chalk.red('Erro:'), err.message);
    process.exit(1);
  });
}
