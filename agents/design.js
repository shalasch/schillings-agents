import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';

dotenv.config();

const client = new Anthropic();

const REFS_DIR = path.resolve('references');
const SUPPORTED_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const MIME = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif' };
const MAX_REFS = 3; // limite para não estourar tokens

async function loadReferences() {
  if (!(await fs.pathExists(REFS_DIR))) return [];
  const files = await fs.readdir(REFS_DIR);
  const imgs = files
    .filter(f => SUPPORTED_EXTS.includes(path.extname(f).toLowerCase()))
    .slice(0, MAX_REFS);
  const blocks = [];
  for (const f of imgs) {
    const data = await fs.readFile(path.join(REFS_DIR, f));
    const ext = path.extname(f).toLowerCase();
    blocks.push({
      type: 'image',
      source: { type: 'base64', media_type: MIME[ext], data: data.toString('base64') },
    });
    console.log(chalk.gray(`  [design] referência carregada: ${f}`));
  }
  return blocks;
}

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

async function loadCopyAprovada(slug) {
  const copyPath = path.resolve('outputs', todayFolder(), slug, 'copy.md');
  const exists = await fs.pathExists(copyPath);
  if (exists) {
    return await fs.readFile(copyPath, 'utf-8');
  }
  return '(copy não disponível — crie o design com base no tema)';
}

async function htmlToScreenshot(htmlPath, pngPath) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.screenshot({ path: pngPath, type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1080 } });
  } finally {
    await browser.close();
  }
}

export async function runDesign(topic) {
  const slug = toSlug(topic);
  const outputDir = path.resolve('outputs', todayFolder(), slug);
  await fs.ensureDir(outputDir);

  const promptTemplate = await fs.readFile(
    path.resolve('prompts/design.md'),
    'utf-8'
  );

  const copyAprovada = await loadCopyAprovada(slug);

  const prompt = promptTemplate
    .replace(/\{topic\}/g, topic)
    .replace(/\{copy_aprovada\}/g, copyAprovada);

  const refBlocks = await loadReferences();
  const userContent = refBlocks.length
    ? [
        ...refBlocks,
        { type: 'text', text: refBlocks.length > 0
            ? `Use as ${refBlocks.length} imagem(ns) acima como referência de estilo/paleta de cores. ${prompt}`
            : prompt },
      ]
    : prompt;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: userContent }],
  });

  const output = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  // Extrai bloco HTML da resposta (entre ```html ... ``` ou HTML puro)
  const htmlMatch = output.match(/```html\s*([\s\S]*?)```/) || output.match(/(<!DOCTYPE html[\s\S]*<\/html>)/i);
  const html = htmlMatch ? htmlMatch[1].trim() : output.trim();

  const htmlPath = path.join(outputDir, 'design.html');
  const pngPath = path.join(outputDir, 'design.png');

  await fs.writeFile(htmlPath, html, 'utf-8');
  console.log(chalk.blue(`  HTML salvo → outputs/${todayFolder()}/${slug}/design.html`));

  await htmlToScreenshot(path.resolve(htmlPath), pngPath);
  console.log(chalk.green(`✓ Design gerado para "${topic}" → outputs/${todayFolder()}/${slug}/design.png`));

  return { html, pngPath };
}

// CLI entry point
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain || process.argv[1]?.includes('design.js')) {
  const topic = process.argv[2];
  if (!topic) {
    console.error(chalk.red('Uso: node agents/design.js "tópico"'));
    process.exit(1);
  }
  runDesign(topic).catch((err) => {
    console.error(chalk.red('Erro:'), err.message);
    process.exit(1);
  });
}
