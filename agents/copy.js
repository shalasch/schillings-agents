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

export async function runCopy(topic) {
  const promptTemplate = await fs.readFile(
    path.resolve('prompts/copy.md'),
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
  await fs.writeFile(path.join(outputDir, 'copy.md'), output, 'utf-8');

  console.log(chalk.green(`✓ Copy gerada para "${topic}" → outputs/${todayFolder()}/${slug}/copy.md`));

  const translationResponse = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: `Translate the following marketing content to English, preserving all formatting, structure, and markdown:\n\n${output}` }],
  });

  const outputEn = translationResponse.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  await fs.writeFile(path.join(outputDir, 'copy-en.md'), outputEn, 'utf-8');

  console.log(chalk.green(`✓ Copy (EN) gerada → outputs/${todayFolder()}/${slug}/copy-en.md`));

  return output;
}

// CLI entry point
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain || process.argv[1]?.includes('copy.js')) {
  const topic = process.argv[2];
  if (!topic) {
    console.error(chalk.red('Uso: node agents/copy.js "tópico"'));
    process.exit(1);
  }
  runCopy(topic).catch((err) => {
    console.error(chalk.red('Erro:'), err.message);
    process.exit(1);
  });
}
