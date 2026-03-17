#!/usr/bin/env node
/**
 * tools/add-reference.js
 * Adiciona uma imagem de referência visual para o agente de design.
 *
 * Uso:
 *   node tools/add-reference.js caminho/para/imagem.png [--name meu-nome]
 *   node tools/add-reference.js --list
 *   node tools/add-reference.js --remove nome-do-arquivo
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

const REFS_DIR = path.resolve('references');
const SUPPORTED = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

async function listReferences() {
  await fs.ensureDir(REFS_DIR);
  const files = await fs.readdir(REFS_DIR);
  const imgs = files.filter(f => SUPPORTED.includes(path.extname(f).toLowerCase()));
  if (!imgs.length) {
    console.log(chalk.yellow('Nenhuma referência salva em references/'));
    return;
  }
  console.log(chalk.cyan('\n── Referências visuais ──'));
  for (const f of imgs) {
    const stat = await fs.stat(path.join(REFS_DIR, f));
    const kb = (stat.size / 1024).toFixed(1);
    console.log(chalk.white(` • ${f}`) + chalk.gray(` (${kb} KB)`));
  }
  console.log('');
}

async function removeReference(name) {
  const target = path.join(REFS_DIR, name);
  if (!(await fs.pathExists(target))) {
    console.error(chalk.red(`Arquivo não encontrado: references/${name}`));
    process.exit(1);
  }
  await fs.remove(target);
  console.log(chalk.green(`✓ Referência removida: ${name}`));
}

async function addReference(srcPath, customName) {
  await fs.ensureDir(REFS_DIR);

  if (!(await fs.pathExists(srcPath))) {
    console.error(chalk.red(`Arquivo não encontrado: ${srcPath}`));
    process.exit(1);
  }

  const ext = path.extname(srcPath).toLowerCase();
  if (!SUPPORTED.includes(ext)) {
    console.error(chalk.red(`Formato não suportado: ${ext}. Use: ${SUPPORTED.join(', ')}`));
    process.exit(1);
  }

  const baseName = customName
    ? customName.replace(/[^a-z0-9-_]/gi, '-').toLowerCase() + ext
    : path.basename(srcPath);

  const destPath = path.join(REFS_DIR, baseName);
  await fs.copy(srcPath, destPath, { overwrite: true });

  const stat = await fs.stat(destPath);
  const kb = (stat.size / 1024).toFixed(1);
  console.log(chalk.green(`✓ Referência adicionada: references/${baseName} (${kb} KB)`));
  console.log(chalk.gray('  O agente de design usará esta imagem na próxima geração.'));
}

// ── CLI ──
const args = process.argv.slice(2);

if (args.includes('--list') || args.includes('-l')) {
  listReferences();
} else if (args.includes('--remove') || args.includes('-r')) {
  const idx = args.findIndex(a => a === '--remove' || a === '-r');
  const name = args[idx + 1];
  if (!name) { console.error(chalk.red('Informe o nome do arquivo para remover.')); process.exit(1); }
  removeReference(name);
} else {
  const srcPath = args[0];
  if (!srcPath) {
    console.log(chalk.yellow('Uso:'));
    console.log('  node tools/add-reference.js imagem.png [--name meu-nome]');
    console.log('  node tools/add-reference.js --list');
    console.log('  node tools/add-reference.js --remove nome.png');
    process.exit(0);
  }
  const nameIdx = args.findIndex(a => a === '--name' || a === '-n');
  const customName = nameIdx >= 0 ? args[nameIdx + 1] : null;
  addReference(srcPath, customName);
}
