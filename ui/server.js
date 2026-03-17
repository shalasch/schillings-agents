import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const OUTPUTS   = path.join(ROOT, 'outputs');
const APPROVED  = path.join(ROOT, 'approved');

const app    = express();
const client = new Anthropic();

app.use(express.json());
app.use(express.static(__dirname));

// ─── helpers ────────────────────────────────────────────────────────────────

function toSlug(text) {
  return text.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function agentFile(agent) {
  const map = {
    copy: 'copy.md', posts: 'posts.md', seo: 'seo.md',
    linkedin: 'linkedin.md', email: 'email.md', funil: 'funil.md',
    anuncio: 'anuncio.md', design: 'design.html',
  };
  return map[agent] || `${agent}.md`;
}

function statusFile(date, topic, agent) {
  return path.join(OUTPUTS, date, topic, `.${agent}.status`);
}

async function getStatus(date, topic, agent) {
  const sf = statusFile(date, topic, agent);
  if (await fs.pathExists(sf)) return (await fs.readFile(sf, 'utf-8')).trim();
  const af = path.join(OUTPUTS, date, topic, agentFile(agent));
  if (await fs.pathExists(af)) return 'aguardando';
  return 'ausente';
}

async function setStatus(date, topic, agent, status) {
  await fs.writeFile(statusFile(date, topic, agent), status, 'utf-8');
}

// ─── agente rerun ────────────────────────────────────────────────────────────

async function buildPrompt(agent, topic, feedback) {
  const SEO_FILE = path.join(ROOT, 'prompts', 'seo-linkedin-email-funil-ads.md');
  const SEPARATOR = /\n---\n---/;

  async function seoSections() {
    const raw = await fs.readFile(SEO_FILE, 'utf-8');
    return raw.split(SEPARATOR);
  }

  const slug = toSlug(topic);
  let template = '';

  if (agent === 'copy') {
    template = await fs.readFile(path.join(ROOT, 'prompts', 'copy.md'), 'utf-8');
  } else if (agent === 'posts') {
    template = await fs.readFile(path.join(ROOT, 'prompts', 'posts.md'), 'utf-8');
  } else if (agent === 'seo') {
    template = (await seoSections())[0];
  } else if (agent === 'linkedin') {
    template = (await seoSections())[1];
  } else if (agent === 'email') {
    template = (await seoSections())[2];
  } else if (agent === 'funil') {
    template = (await seoSections())[3];
  } else if (agent === 'anuncio') {
    template = (await seoSections())[4];
  } else if (agent === 'design') {
    template = await fs.readFile(path.join(ROOT, 'prompts', 'design.md'), 'utf-8');
    const copyPath = path.join(OUTPUTS, new Date().toISOString().slice(0,10), slug, 'copy.md');
    const copy = (await fs.pathExists(copyPath))
      ? await fs.readFile(copyPath, 'utf-8')
      : '(copy não disponível)';
    template = template.replace(/\{copy_aprovada\}/g, copy);
  }

  let prompt = template.replace(/\{topic\}/g, topic);

  if (feedback) {
    prompt += `\n\n---\n## REVISÃO SOLICITADA\n${feedback}\n\nRegeregere o conteúdo aplicando o feedback acima.`;
  }

  return prompt;
}

async function rerunAgent(agent, topic, date, feedback) {
  const slug    = toSlug(topic);
  const prompt  = await buildPrompt(agent, topic, feedback);
  const outDir  = path.join(OUTPUTS, date, slug);
  await fs.ensureDir(outDir);

  if (agent === 'design') {
    const { default: puppeteer } = await import('puppeteer');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    const htmlMatch = raw.match(/```html\s*([\s\S]*?)```/) || raw.match(/(<!DOCTYPE html[\s\S]*<\/html>)/i);
    const html = htmlMatch ? htmlMatch[1].trim() : raw.trim();

    const htmlPath = path.join(outDir, 'design.html');
    const pngPath  = path.join(outDir, 'design.png');
    await fs.writeFile(htmlPath, html, 'utf-8');

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.screenshot({ path: pngPath, type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1080 } });
    await browser.close();
    return html;
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });
  const output = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  await fs.writeFile(path.join(outDir, agentFile(agent)), output, 'utf-8');
  return output;
}

// ─── rotas ───────────────────────────────────────────────────────────────────

// GET /api/sessions
app.get('/api/sessions', async (req, res) => {
  try {
    if (!await fs.pathExists(OUTPUTS)) return res.json([]);
    const dates  = await fs.readdir(OUTPUTS);
    const sessions = [];
    for (const date of dates.sort().reverse()) {
      const datePath = path.join(OUTPUTS, date);
      const stat = await fs.stat(datePath);
      if (!stat.isDirectory()) continue;
      const topics = await fs.readdir(datePath);
      for (const topic of topics) {
        const topicPath = path.join(datePath, topic);
        const ts = await fs.stat(topicPath);
        if (!ts.isDirectory()) continue;
        sessions.push({ date, topic });
      }
    }
    res.json(sessions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/session/:date/:topic
app.get('/api/session/:date/:topic', async (req, res) => {
  try {
    const { date, topic } = req.params;
    const dir = path.join(OUTPUTS, date, topic);
    if (!await fs.pathExists(dir)) return res.status(404).json({ error: 'not found' });

    const agents = ['copy', 'posts', 'seo', 'linkedin', 'email', 'funil', 'anuncio', 'design'];
    const result = [];
    for (const agent of agents) {
      const file   = agentFile(agent);
      const exists = await fs.pathExists(path.join(dir, file));
      const status = await getStatus(date, topic, agent);
      result.push({ agent, file, exists, status });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/content/:date/:topic/:agent
app.get('/api/content/:date/:topic/:agent', async (req, res) => {
  try {
    const { date, topic, agent } = req.params;
    const filePath = path.join(OUTPUTS, date, topic, agentFile(agent));
    if (!await fs.pathExists(filePath)) return res.status(404).json({ error: 'not found' });
    const content = await fs.readFile(filePath, 'utf-8');
    const status  = await getStatus(date, topic, agent);
    res.json({ content, status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/image/:date/:topic
app.get('/api/image/:date/:topic', async (req, res) => {
  try {
    const { date, topic } = req.params;
    const imgPath = path.join(OUTPUTS, date, topic, 'design.png');
    if (!await fs.pathExists(imgPath)) return res.status(404).json({ error: 'not found' });
    res.sendFile(imgPath);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/approve/:date/:topic/:agent
app.post('/api/approve/:date/:topic/:agent', async (req, res) => {
  try {
    const { date, topic, agent } = req.params;
    const src = path.join(OUTPUTS, date, topic, agentFile(agent));
    const dst = path.join(APPROVED, date, topic, agentFile(agent));
    if (!await fs.pathExists(src)) return res.status(404).json({ error: 'not found' });
    await fs.ensureDir(path.dirname(dst));
    await fs.copy(src, dst);
    await setStatus(date, topic, agent, 'aprovado');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/reject/:date/:topic/:agent
app.post('/api/reject/:date/:topic/:agent', async (req, res) => {
  try {
    const { date, topic, agent } = req.params;
    const { feedback = '' } = req.body;
    const rejPath = path.join(OUTPUTS, date, topic, `.${agent}.rejected`);
    await fs.writeFile(rejPath, feedback, 'utf-8');
    await setStatus(date, topic, agent, 'rejeitado');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/content-save/:date/:topic/:agent
app.post('/api/content-save/:date/:topic/:agent', async (req, res) => {
  try {
    const { date, topic, agent } = req.params;
    const { content = '' } = req.body;
    const filePath = path.join(OUTPUTS, date, topic, agentFile(agent));
    await fs.writeFile(filePath, content, 'utf-8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/rerun/:date/:topic/:agent
app.post('/api/rerun/:date/:topic/:agent', async (req, res) => {
  try {
    const { date, topic, agent } = req.params;
    const { feedback = '' } = req.body;
    await setStatus(date, topic, agent, 'gerando');
    const output = await rerunAgent(agent, topic, date, feedback);
    await setStatus(date, topic, agent, 'aguardando');
    res.json({ ok: true, output });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/run — SSE stream (roda agentes em sequência)
app.get('/api/run', async (req, res) => {
  const { topic, agents, date } = req.query;
  if (!topic) return res.status(400).end('topic required');

  const slug     = toSlug(topic);
  const runDate  = date || new Date().toISOString().slice(0, 10);
  const ORDER    = ['copy','posts','seo','linkedin','email','funil','anuncio','design'];
  const agentList = agents ? agents.split(',').filter(a => ORDER.includes(a)) : ORDER;
  // design sempre por último
  const queue = [...agentList.filter(a => a !== 'design'), ...(agentList.includes('design') ? ['design'] : [])];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  await fs.ensureDir(path.join(OUTPUTS, runDate, slug));
  send({ agent: '_start', status: 'start', date: runDate, topic: slug,
         message: `Iniciando ${queue.length} agentes para "${topic}"` });

  for (const agent of queue) {
    await setStatus(runDate, slug, agent, 'gerando');
    send({ agent, status: 'running', message: `${agent.toUpperCase()} está gerando conteúdo...` });
    try {
      await rerunAgent(agent, topic, runDate, '');
      await setStatus(runDate, slug, agent, 'aguardando');
      send({ agent, status: 'done', message: `${agent.toUpperCase()} concluído com sucesso!` });
    } catch (e) {
      await setStatus(runDate, slug, agent, 'aguardando');
      send({ agent, status: 'error', message: `${agent.toUpperCase()} falhou: ${e.message}` });
    }
  }

  send({ agent: '_end', status: 'complete', date: runDate, topic: slug,
         message: 'Todos os agentes finalizaram!' });
  res.end();
});

// ─── start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\x1b[36m▶ UI rodando em http://localhost:${PORT}\x1b[0m`);
});
