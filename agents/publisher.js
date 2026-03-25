import fs from 'fs-extra';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

const BUFFER_API_BASE = 'https://api.bufferapp.com/1';
const ACCESS_TOKEN = process.env.BUFFER_ACCESS_TOKEN;

async function bufferPost(profileId, text, mediaUrl = null) {
  if (!ACCESS_TOKEN) throw new Error('BUFFER_ACCESS_TOKEN não configurado no .env');

  const body = new URLSearchParams({
    'profile_ids[]': profileId,
    text,
    access_token: ACCESS_TOKEN,
    now: 'true',
  });

  if (mediaUrl) {
    body.append('media[photo]', mediaUrl);
  }

  const res = await fetch(`${BUFFER_API_BASE}/updates/create.json`, {
    method: 'POST',
    body,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Buffer API error: ${data.message || res.statusText}`);
  }

  return data;
}

export async function publishLinkedIn(content) {
  const profileId = process.env.BUFFER_LINKEDIN_PROFILE_ID;
  if (!profileId) throw new Error('BUFFER_LINKEDIN_PROFILE_ID não configurado no .env');

  console.log(chalk.blue('→ Publicando no LinkedIn via Buffer...'));
  const result = await bufferPost(profileId, content);
  console.log(chalk.green(`✓ LinkedIn publicado (update id: ${result.updates?.[0]?.id})`));
  return result;
}

export async function publishInstagram(content, imagePath = null) {
  const profileId = process.env.BUFFER_INSTAGRAM_PROFILE_ID;
  if (!profileId) throw new Error('BUFFER_INSTAGRAM_PROFILE_ID não configurado no .env');

  let mediaUrl = imagePath;

  // Se imagePath for um caminho local, avisa que Buffer exige URL pública
  if (imagePath && !imagePath.startsWith('http')) {
    console.log(chalk.yellow('⚠ Instagram via Buffer requer URL pública da imagem. Publicando sem mídia.'));
    mediaUrl = null;
  }

  console.log(chalk.blue('→ Publicando no Instagram via Buffer...'));
  const result = await bufferPost(profileId, content, mediaUrl);
  console.log(chalk.green(`✓ Instagram publicado (update id: ${result.updates?.[0]?.id})`));
  return result;
}
