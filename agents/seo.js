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

function extractSeoSection(fullContent) {
  // O arquivo contém múltiplos agentes separados por "---\n---"
  // A seção SEO é a primeira — tudo antes do primeiro separador duplo
  const separator = /\n---\n---/;
  const parts = fullContent.split(separator);
  return parts[0].trim();
}

export async function runSeo(topic) {
  const fullTemplate = await fs.readFile(
    path.resolve('prompts/seo-linkedin-email-funil-ads.md'),
    'utf-8'
  );

  const seoSection = extractSeoSection(fullTemplate);
  const prompt = seoSection.replace(/\{topic\}/g, topic);

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
  await fs.writeFile(path.join(outputDir, 'seo.md'), output, 'utf-8');

  console.log(chalk.green(`✓ SEO gerado para "${topic}" → outputs/${todayFolder()}/${slug}/seo.md`));

  const translationResponse = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: `Translate the following marketing content to English, preserving all formatting, structure, and markdown:\n\n${output}` }],
  });

  const outputEn = translationResponse.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  await fs.writeFile(path.join(outputDir, 'seo-en.md'), outputEn, 'utf-8');

  console.log(chalk.green(`✓ SEO (EN) gerado → outputs/${todayFolder()}/${slug}/seo-en.md`));

  return output;
}

// CLI entry point
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain || process.argv[1]?.includes('seo.js')) {
  const topic = process.argv[2];
  if (!topic) {
    console.error(chalk.red('Uso: node agents/seo.js "tópico"'));
    process.exit(1);
  }
  runSeo(topic).catch((err) => {
    console.error(chalk.red('Erro:'), err.message);
    process.exit(1);
  });
}
