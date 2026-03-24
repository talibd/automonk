const db = require('../../config/db');
const { redis } = require('../../config/redis');
const { enqueuePipeline } = require('../../queue/queues');
const logger = require('../../utils/logger');

const STATE_TTL = 15 * 60;
const stateKey = (chatId) => `run:${chatId}`;

function normalizeClientHint(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/^for\s+/i, '')
    .replace(/^run\s+/i, '')
    .replace(/^client\s+/i, '')
    .trim();
}

async function getClients() {
  const { rows } = await db.query(
    `SELECT c.id, c.name, cs.approval_mode, cs.active_platforms
     FROM clients c
     LEFT JOIN client_settings cs ON cs.client_id = c.id
     WHERE c.archived = FALSE
     ORDER BY c.name`
  );
  return rows;
}

function findClient(clients, rawHint) {
  const hint = normalizeClientHint(rawHint);
  if (!hint) return null;

  return (
    clients.find(c => c.name.toLowerCase() === hint) ||
    clients.find(c => c.name.toLowerCase().startsWith(hint)) ||
    clients.find(c => c.name.toLowerCase().includes(hint))
  );
}

async function setState(chatId, state) {
  await redis.setex(stateKey(chatId), STATE_TTL, JSON.stringify(state));
}

async function getState(chatId) {
  const raw = await redis.get(stateKey(chatId));
  return raw ? JSON.parse(raw) : null;
}

async function clearState(chatId) {
  await redis.del(stateKey(chatId));
}

async function replyWithClientPicker(ctx, clients) {
  const list = clients.map(c => `- ${c.name}`).join('\n');
  await ctx.reply(
    `I can trigger the pipeline for any of your ${clients.length} clients. Which one?\n\n${list}\n\nReply with the client name, for example: "for monk".`
  );
}

async function runForClient(ctx, client) {
  const activePlatforms = client.active_platforms || [];

  if (!activePlatforms.length) {
    return ctx.reply(
      `${client.name} has no active platforms connected yet. Run /connect ${client.name} first.`
    );
  }

  const job = await enqueuePipeline(client.id);
  const mode = client.approval_mode || 'supervised';
  const outcome = mode === 'supervised'
    ? `Posts will land in pending for approval.`
    : `Posts will be rendered and scheduled automatically.`;

  await ctx.reply(
    `Running it now for ${client.name}.\n\nQueued pipeline job ${job.id} for ${activePlatforms.join(', ')}.\n${outcome}`
  );
}

async function handleRun(ctx) {
  const chatId = String(ctx.chat.id);
  const clients = await getClients();

  if (!clients.length) {
    return ctx.reply('No active clients yet. Run /onboard to add one first.');
  }

  const rawHint = ctx.message.text.trim().split(/\s+/).slice(1).join(' ');
  if (!rawHint) {
    await setState(chatId, { awaiting_client: true });
    return replyWithClientPicker(ctx, clients);
  }

  const client = findClient(clients, rawHint);
  if (!client) {
    await setState(chatId, { awaiting_client: true });
    await ctx.reply(`No client found matching "${rawHint}".`);
    return replyWithClientPicker(ctx, clients);
  }

  await clearState(chatId);
  try {
    await runForClient(ctx, client);
  } catch (err) {
    logger.error('Run command failed', { clientId: client.id, error: err.message });
    await ctx.reply(`Failed to queue the pipeline for ${client.name}: ${err.message}`);
  }
}

function looksLikeRunIntent(text) {
  const normalized = text.trim().toLowerCase();
  return (
    normalized.includes('make test post') ||
    normalized.includes('create test post') ||
    normalized.includes('run pipeline') ||
    normalized.includes('trigger pipeline') ||
    normalized.includes('make post now')
  );
}

async function handleRunText(ctx) {
  const chatId = String(ctx.chat.id);
  const text = ctx.message.text.trim();
  const clients = await getClients();
  if (!clients.length) return false;

  const state = await getState(chatId);
  if (state?.awaiting_client) {
    const client = findClient(clients, text);
    if (!client) {
      await ctx.reply(`I couldn't match "${text}" to a client. Reply with one of: ${clients.map(c => c.name).join(', ')}`);
      return true;
    }

    await clearState(chatId);
    try {
      await runForClient(ctx, client);
    } catch (err) {
      logger.error('Run text follow-up failed', { clientId: client.id, error: err.message });
      await ctx.reply(`Failed to queue the pipeline for ${client.name}: ${err.message}`);
    }
    return true;
  }

  if (!looksLikeRunIntent(text)) return false;

  await setState(chatId, { awaiting_client: true });
  await replyWithClientPicker(ctx, clients);
  return true;
}

module.exports = { handleRun, handleRunText };
