/**
 * Seeds a single test client for Phase 1 development.
 * Run: node db/seed.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT, 10),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert test client
    const { rows: [c] } = await client.query(
      `INSERT INTO clients (name) VALUES ($1)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      ['Test Client']
    );

    if (!c) {
      console.log('Test client already exists, skipping seed.');
      await client.query('ROLLBACK');
      return;
    }

    const clientId = c.id;

    // Insert client settings
    await client.query(
      `INSERT INTO client_settings (
        client_id, active_platforms, niche, tone_of_voice, target_audience,
        hashtag_sets, cta_preferences, idea_frequency, approval_mode,
        weekly_optimization, posting_times
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        clientId,
        ['instagram'],
        'personal finance for millennials',
        'educational, conversational, no financial jargon',
        'millennials aged 25-35 who want to build wealth without complexity',
        JSON.stringify({
          instagram: {
            primary: ['#personalfinance', '#moneytips', '#financialfreedom', '#savemoney', '#investing'],
            niche: ['#budgeting', '#sidehustle', '#wealthbuilding', '#financialindependence'],
          }
        }),
        JSON.stringify({
          instagram: 'Save this for your next money move',
        }),
        'daily',
        'supervised',
        true,
        JSON.stringify({
          instagram: '19:00',
        }),
      ]
    );

    // Insert placeholder Instagram account (tokens must be real to publish)
    await client.query(
      `INSERT INTO platform_accounts
        (client_id, platform, account_id, access_token, active)
       VALUES ($1,$2,$3,$4,$5)`,
      [clientId, 'instagram', 'PLACEHOLDER_ACCOUNT_ID', 'PLACEHOLDER_ACCESS_TOKEN', false]
    );

    await client.query('COMMIT');
    console.log(`✓ Seeded test client with id=${clientId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
