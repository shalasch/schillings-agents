import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

import { runCopy }    from './agents/copy.js';
import { runPosts }   from './agents/posts.js';
import { runSeo }     from './agents/seo.js';
import { runLinkedin } from './agents/linkedin.js';
import { runEmail }   from './agents/email.js';
import { runFunil }   from './agents/funil.js';
import { runAnuncio } from './agents/anuncio.js';
import { runDesign }  from './agents/design.js';

// ─── helpers ────────────────────────────────────────────────────────────────

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

function parseArgs() {
  const args = process.argv.slice(2);
  if (!args.length) return null;

  let topic = null;
  let selectedAgents = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--agents' && args[i + 1]) {
      selectedAgents = args[i + 1].split(',').map((a) => a.trim().toLowerCase());
      i++;
    } else if (!args[i].startsWith('--')) {
      topic = args[i];
    }
  }

  return { topic, selectedAgents };
}

// ─── UI ─────────────────────────────────────────────────────────────────────

const W = 58;

function box(lines, color = chalk.cyan) {
  const top    = color('╔' + '═'.repeat(W) + '╗');
  const bottom = color('╚' + '═'.repeat(W) + '╝');
  const mid    = lines.map((l) => color('║') + ' ' + l.padEnd(W - 2) + ' ' + color('║'));
  console.log([top, ...mid, bottom].join('\n'));
}

function divider(color = chalk.cyan) {
  console.log(color('╠' + '═'.repeat(W) + '╣'));
}

function row(label, value, labelColor = chalk.cyan, valueColor = chalk.white) {
  const l = labelColor('║') + ' ' + chalk.bold(label.padEnd(18));
  const v = valueColor(String(value).padEnd(W - 21)) + ' ' + labelColor('║');
  console.log(l + v);
}

function banner(topic) {
  console.log('');
  box([
    chalk.yellow('  ░██████╗░█████╗░██╗░░██╗██╗██╗░░░░░██╗░░░░░██╗███╗░░██╗░██████╗░░██████╗'),
    chalk.yellow('  ██╔════╝██╔══██╗██║░░██║██║██║░░░░░██║░░░░░██║████╗░██║██╔════╝░██╔════╝'),
    chalk.yellow('  ╚█████╗░██║░░╚═╝███████║██║██║░░░░░██║░░░░░██║██╔██╗██║██║░░██╗░╚█████╗░'),
    chalk.yellow('  ░╚═══██╗██║░░██╗██╔══██║██║██║░░░░░██║░░░░░██║██║╚████║██║░░╚██╗░╚═══██╗'),
    chalk.yellow('  ██████╔╝╚█████╔╝██║░░██║██║███████╗███████╗██║██║░╚███║╚██████╔╝██████╔╝'),
    chalk.yellow('  ╚═════╝░░╚════╝░╚═╝░░╚═╝╚═╝╚══════╝╚══════╝╚═╝╚═╝░░╚══╝░╚═════╝░╚═════╝'),
    '',
    chalk.white('  ') + chalk.bgBlue.white.bold('  AGENTS — Schilling\'s English Course  '),
    '',
    chalk.cyan('  Tema : ') + chalk.white.bold(topic),
    chalk.cyan('  Data : ') + chalk.white(todayFolder()),
  ], chalk.blue);
  console.log('');
}

function logStart(name) {
  console.log(chalk.cyan('┌─') + chalk.bold.white(` ▶ ${name.toUpperCase()} `) + chalk.cyan('─'.repeat(Math.max(0, W - name.length - 4))));
}

function logDone(name, file) {
  console.log(chalk.green('└─') + chalk.green.bold(` ✓ ${name.toUpperCase()} `) + chalk.gray(`→ ${file}`));
  console.log('');
}

function logSkip(name) {
  console.log(chalk.gray(`░░ SKIP ${name.toUpperCase()}`));
}

function logError(name, err) {
  console.log(chalk.red('└─') + chalk.red.bold(` ✗ ${name.toUpperCase()} `) + chalk.red(err.message));
  console.log('');
}

function summary(results, slug) {
  const date = todayFolder();
  const base = `outputs/${date}/${slug}`;
  console.log('');
  box([
    chalk.yellow.bold('  RESUMO FINAL'),
    '',
    ...results.map(({ name, status, file }) => {
      const icon   = status === 'ok' ? chalk.green('✓') : status === 'skip' ? chalk.gray('░') : chalk.red('✗');
      const label  = chalk.white(name.padEnd(12));
      const detail = status === 'ok'
        ? chalk.gray(file)
        : status === 'skip'
        ? chalk.gray('(ignorado)')
        : chalk.red('ERRO');
      return `  ${icon}  ${label}  ${detail}`;
    }),
    '',
    chalk.cyan(`  Pasta: ${base}`),
  ], chalk.blue);
  console.log('');
}

// ─── agentes ────────────────────────────────────────────────────────────────

const ALL_AGENTS = ['copy', 'posts', 'seo', 'linkedin', 'email', 'funil', 'anuncio', 'design'];

const AGENT_MAP = {
  copy:     { fn: runCopy,    out: 'copy.md'     },
  posts:    { fn: runPosts,   out: 'posts.md'    },
  seo:      { fn: runSeo,     out: 'seo.md'      },
  linkedin: { fn: runLinkedin,out: 'linkedin.md' },
  email:    { fn: runEmail,   out: 'email.md'    },
  funil:    { fn: runFunil,   out: 'funil.md'    },
  anuncio:  { fn: runAnuncio, out: 'anuncio.md'  },
  design:   { fn: runDesign,  out: 'design.png'  },
};

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const parsed = parseArgs();

  if (!parsed || !parsed.topic) {
    console.error(chalk.red('Uso: node main.js "tema" [--agents copy,posts,seo]'));
    process.exit(1);
  }

  const { topic, selectedAgents } = parsed;
  const slug = toSlug(topic);
  const date = todayFolder();

  // garante a pasta de output
  await fs.ensureDir(path.resolve('outputs', date, slug));

  // define quais agentes rodar (design sempre por último se incluído)
  let queue = selectedAgents
    ? ALL_AGENTS.filter((a) => selectedAgents.includes(a))
    : [...ALL_AGENTS];

  // garante que design é sempre o último
  if (queue.includes('design')) {
    queue = [...queue.filter((a) => a !== 'design'), 'design'];
  }

  banner(topic);

  const results = [];

  for (const name of ALL_AGENTS) {
    if (!queue.includes(name)) {
      logSkip(name);
      results.push({ name, status: 'skip', file: null });
      continue;
    }

    const { fn, out } = AGENT_MAP[name];
    const filePath = `outputs/${date}/${slug}/${out}`;

    logStart(name);
    try {
      await fn(topic);
      logDone(name, filePath);
      results.push({ name, status: 'ok', file: filePath });
    } catch (err) {
      logError(name, err);
      results.push({ name, status: 'error', file: null });
    }
  }

  summary(results, slug);
}

main();
