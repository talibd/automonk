const { Markup } = require('telegraf');
const db = require('../../config/db');
const logger = require('../../utils/logger');

async function handlePending(ctx) {
  try {
    const { rows } = await db.query(`
      SELECT p.id, p.client_id, c.name AS client_name,
             p.master_script->>'title' AS topic,
             p.created_at,
             COUNT(pv.id) AS variant_count
      FROM posts p
      JOIN clients c ON c.id = p.client_id
      JOIN post_variants pv ON pv.post_id = p.id AND pv.status = 'pending_approval'
      WHERE p.status = 'approval_pending'
      GROUP BY p.id, c.name
      ORDER BY p.created_at ASC
    `);

    if (!rows.length) {
      return ctx.reply('No posts awaiting approval.');
    }

    await ctx.reply(`${rows.length} post(s) awaiting approval:`);

    for (const row of rows) {
      const ageMs  = Date.now() - new Date(row.created_at).getTime();
      const ageMin = Math.round(ageMs / 60000);
      const ageStr = ageMin < 60 ? `${ageMin}m ago` : `${Math.round(ageMin / 60)}h ago`;

      const text = [
        `<b>${row.client_name}</b>`,
        `Topic: "${row.topic ?? 'Untitled'}"`,
        `Platforms: ${row.variant_count}`,
        `Generated: ${ageStr}`,
        `Post <code>#${row.id}</code>`,
      ].join('\n');

      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Approve', `approve:${row.id}`),
            Markup.button.callback('❌ Reject',  `reject_prompt:${row.id}`),
          ],
        ]),
      });
    }
  } catch (err) {
    logger.error('Pending command failed', { error: err.message });
    await ctx.reply('Failed to load pending posts.');
  }
}

module.exports = { handlePending };
