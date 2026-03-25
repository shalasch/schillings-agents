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

async function buildPrompt(agent, topic, feedback, lang) {
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

  if (lang === 'en') {
    prompt += `\n\n---\n## LANGUAGE INSTRUCTION — CRITICAL\nThe entire output MUST be in English. This is non-negotiable and overrides all other instructions.\n\nThis applies to EVERYTHING without exception:\n- Section headers and labels (e.g. "DETECTED AUDIENCE" not "PÚBLICO DETECTADO", "Tone:" not "Tom:", "SOCIAL MEDIA HOOKS" not "HOOKS PARA REDES SOCIAIS", "VERSION A (Pain-based)" not "VERSÃO A (Baseada na dor)", "BENEFIT BULLETS" not "BULLETS DE BENEFÍCIO")\n- All body text, headlines, subheadlines, bullets, CTAs\n- Structural markers, field names, category labels\n- Examples, captions, hashtag descriptions\n- Any word or phrase in the output\n\nDo NOT output a single word in Portuguese. Translate every structural label from the prompt template into English before outputting it.`;
  }

  if (feedback) {
    prompt += `\n\n---\n## REVISÃO SOLICITADA\n${feedback}\n\nRegere o conteúdo aplicando o feedback acima.`;
  }

  return prompt;
}

async function rerunAgent(agent, topic, date, feedback, lang) {
  const slug    = toSlug(topic);
  const prompt  = await buildPrompt(agent, topic, feedback, lang);
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

    const agents = ['copy', 'posts', 'seo', 'linkedin', 'email', 'funil', 'anuncio'];
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
    const { feedback = '', lang = 'pt' } = req.body;
    await setStatus(date, topic, agent, 'gerando');
    const output = await rerunAgent(agent, topic, date, feedback, lang);
    await setStatus(date, topic, agent, 'aguardando');
    res.json({ ok: true, output });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/run — SSE stream (roda agentes em sequência)
app.get('/api/run', async (req, res) => {
  const { topic, agents, date, lang = 'pt' } = req.query;
  if (!topic) return res.status(400).end('topic required');

  const slug     = toSlug(topic);
  const runDate  = date || new Date().toISOString().slice(0, 10);
  const ORDER    = ['copy','posts','seo','linkedin','email','funil','anuncio'];
  const agentList = agents ? agents.split(',').filter(a => ORDER.includes(a)) : ORDER;
  const queue = agentList;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  await fs.ensureDir(path.join(OUTPUTS, runDate, slug));
  send({ agent: '_start', status: 'start', date: runDate, topic: slug,
         msgKey: 'log_starting_agents', msgArgs: { count: queue.length, topic } });

  for (const agent of queue) {
    await setStatus(runDate, slug, agent, 'gerando');
    send({ agent, status: 'running', msgKey: 'log_agent_running', msgArgs: { agent: agent.toUpperCase() } });
    try {
      await rerunAgent(agent, topic, runDate, '', lang);
      await setStatus(runDate, slug, agent, 'aguardando');
      send({ agent, status: 'done', msgKey: 'log_agent_done', msgArgs: { agent: agent.toUpperCase() } });
    } catch (e) {
      await setStatus(runDate, slug, agent, 'aguardando');
      send({ agent, status: 'error', msgKey: 'log_agent_error', msgArgs: { agent: agent.toUpperCase(), err: e.message } });
    }
  }

  send({ agent: '_end', status: 'complete', date: runDate, topic: slug,
         msgKey: 'log_all_done' });
  res.end();
});

// GET /api/queue
app.get('/api/queue', async (req, res) => {
  try {
    const qf = path.join(ROOT, 'outputs', 'queue.json');
    if (!await fs.pathExists(qf)) return res.json([]);
    res.json(await fs.readJson(qf));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/queue/:id
app.delete('/api/queue/:id', async (req, res) => {
  try {
    const qf = path.join(ROOT, 'outputs', 'queue.json');
    if (!await fs.pathExists(qf)) return res.json({ ok: true });
    const queue = await fs.readJson(qf);
    const filtered = queue.filter(item => item.id !== req.params.id);
    await fs.writeJson(qf, filtered, { spaces: 2 });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/session/:date/:topic
app.delete('/api/session/:date/:topic', async (req, res) => {
  try {
    const { date, topic } = req.params;
    const dir = path.join(OUTPUTS, date, topic);
    if (!await fs.pathExists(dir)) return res.status(404).json({ error: 'not found' });
    await fs.remove(dir);
    // Remove a pasta de data se estiver vazia
    const dateDir = path.join(OUTPUTS, date);
    const remaining = await fs.readdir(dateDir);
    if (remaining.length === 0) await fs.remove(dateDir);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/plans — list all saved plans (newest first)
app.get('/api/plans', async (req, res) => {
  try {
    const plansDir = path.join(ROOT, 'outputs', 'plans');
    if (!await fs.pathExists(plansDir)) return res.json([]);
    const files = (await fs.readdir(plansDir))
      .filter(f => f.endsWith('.json'))
      .sort().reverse();
    const list = await Promise.all(files.map(async f => {
      const p = await fs.readJson(path.join(plansDir, f));
      return { id: p.id || f.replace('.json',''), generatedAt: p.generatedAt, preview: (p.analysis || '').slice(0, 80) };
    }));
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/plans/:id — get a specific plan
app.get('/api/plans/:id', async (req, res) => {
  try {
    const planPath = path.join(ROOT, 'outputs', 'plans', req.params.id + '.json');
    if (!await fs.pathExists(planPath)) return res.status(404).json({ error: 'not found' });
    res.json(await fs.readJson(planPath));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/plan
app.get('/api/plan', async (req, res) => {
  try {
    const pf = path.join(ROOT, 'outputs', 'plan.json');
    if (!await fs.pathExists(pf)) return res.status(404).json({ error: 'not found' });
    res.json(await fs.readJson(pf));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/orchestrator
app.post('/api/orchestrator', async (req, res) => {
  try {
    const { runOrchestrator } = await import('../agents/orchestrator.js');
    const { lang = 'pt' } = req.body || {};
    const plan = await runOrchestrator(lang);
    res.json(plan);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\x1b[36m▶ UI rodando em http://localhost:${PORT}\x1b[0m`);
});
