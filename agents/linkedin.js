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

function extractLinkedinSection(fullContent) {
  // Seções separadas por "---\n---": [0] SEO, [1] LinkedIn, [2] Email, [3] Funil, [4] Anúncios
  const parts = fullContent.split(/\n---\n---/);
  return parts[1].trim();
}

export async function runLinkedin(topic) {
  const fullTemplate = await fs.readFile(
    path.resolve('prompts/seo-linkedin-email-funil-ads.md'),
    'utf-8'
  );

  const linkedinSection = extractLinkedinSection(fullTemplate);
  const prompt = linkedinSection.replace(/\{topic\}/g, topic);

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
  await fs.writeFile(path.join(outputDir, 'linkedin.md'), output, 'utf-8');

  console.log(chalk.green(`✓ LinkedIn gerado para "${topic}" → outputs/${todayFolder()}/${slug}/linkedin.md`));

  const translationResponse = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: `Translate the following marketing content to English, preserving all formatting, structure, and markdown:\n\n${output}` }],
  });

  const outputEn = translationResponse.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  await fs.writeFile(path.join(outputDir, 'linkedin-en.md'), outputEn, 'utf-8');

  console.log(chalk.green(`✓ LinkedIn (EN) gerado → outputs/${todayFolder()}/${slug}/linkedin-en.md`));

  return output;
}

// CLI entry point
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain || process.argv[1]?.includes('linkedin.js')) {
  const topic = process.argv[2];
  if (!topic) {
    console.error(chalk.red('Uso: node agents/linkedin.js "tópico"'));
    process.exit(1);
  }
  runLinkedin(topic).catch((err) => {
    console.error(chalk.red('Erro:'), err.message);
    process.exit(1);
  });
}
