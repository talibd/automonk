-- Migration: 001_initial_schema
-- Created: 2026-03-19

BEGIN;

-- ─── clients ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived    BOOLEAN NOT NULL DEFAULT FALSE
);

-- ─── client_settings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_settings (
  id                   SERIAL PRIMARY KEY,
  client_id            INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  active_platforms     TEXT[]  NOT NULL DEFAULT '{}',
  niche                TEXT    NOT NULL DEFAULT '',
  tone_of_voice        TEXT    NOT NULL DEFAULT '',
  target_audience      TEXT    NOT NULL DEFAULT '',
  hashtag_sets         JSONB   NOT NULL DEFAULT '{}',
  cta_preferences      JSONB   NOT NULL DEFAULT '{}',
  idea_frequency       TEXT    NOT NULL DEFAULT 'daily'
                         CHECK (idea_frequency IN ('daily','every_2_days','weekly','manual')),
  approval_mode        TEXT    NOT NULL DEFAULT 'supervised'
                         CHECK (approval_mode IN ('supervised','auto')),
  weekly_optimization  BOOLEAN NOT NULL DEFAULT TRUE,
  posting_times        JSONB   NOT NULL DEFAULT '{}',
  onboarded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id)
);

-- ─── platform_accounts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_accounts (
  id              SERIAL PRIMARY KEY,
  client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform        TEXT    NOT NULL
                    CHECK (platform IN ('instagram','facebook','youtube','linkedin','twitter','threads')),
  account_id      TEXT    NOT NULL,
  access_token    TEXT    NOT NULL,
  refresh_token   TEXT,
  token_expiry    TIMESTAMPTZ,
  template_path   TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, platform)
);

-- ─── posts ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id                 SERIAL PRIMARY KEY,
  client_id          INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ideas              JSONB   NOT NULL DEFAULT '[]',
  selected_idea_rank INTEGER,
  master_script      JSONB,
  status             TEXT    NOT NULL DEFAULT 'idea_pending'
                       CHECK (status IN (
                         'idea_pending','idea_ready','script_pending','script_ready',
                         'adapting','adapted','approval_pending','approved','rejected',
                         'rendering','rendered','scheduling','scheduled','posting',
                         'posted','failed'
                       )),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── post_variants ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_variants (
  id                 SERIAL PRIMARY KEY,
  post_id            INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  client_id          INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform           TEXT    NOT NULL
                       CHECK (platform IN ('instagram','facebook','youtube','linkedin','twitter','threads')),
  content_type       TEXT    NOT NULL
                       CHECK (content_type IN ('carousel','static_image','text_post','youtube_package')),
  adapted_script     JSONB,
  image_urls         TEXT[]  DEFAULT '{}',
  storage_path       TEXT,
  status             TEXT    NOT NULL DEFAULT 'draft'
                       CHECK (status IN (
                         'draft','pending_approval','approved','scheduled',
                         'posted','failed','deleted'
                       )),
  scheduled_at       TIMESTAMPTZ,
  posted_at          TIMESTAMPTZ,
  deleted_at         TIMESTAMPTZ,
  platform_post_id   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── post_stats ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_stats (
  id               SERIAL PRIMARY KEY,
  post_variant_id  INTEGER NOT NULL REFERENCES post_variants(id) ON DELETE CASCADE,
  client_id        INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform         TEXT    NOT NULL,
  likes            INTEGER DEFAULT 0,
  comments         INTEGER DEFAULT 0,
  shares           INTEGER DEFAULT 0,
  saves            INTEGER DEFAULT 0,
  reach            INTEGER DEFAULT 0,
  impressions      INTEGER DEFAULT 0,
  clicks           INTEGER DEFAULT 0,
  views            INTEGER DEFAULT 0,
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── client_strategy ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_strategy (
  id            SERIAL PRIMARY KEY,
  client_id     INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL DEFAULT 1,
  strategy      JSONB   NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── schedules ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedules (
  id               SERIAL PRIMARY KEY,
  client_id        INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  post_variant_id  INTEGER NOT NULL REFERENCES post_variants(id) ON DELETE CASCADE,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  bull_job_id      TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_posts_client_id          ON posts(client_id);
CREATE INDEX IF NOT EXISTS idx_posts_status             ON posts(status);
CREATE INDEX IF NOT EXISTS idx_post_variants_post_id    ON post_variants(post_id);
CREATE INDEX IF NOT EXISTS idx_post_variants_client_id  ON post_variants(client_id);
CREATE INDEX IF NOT EXISTS idx_post_variants_status     ON post_variants(status);
CREATE INDEX IF NOT EXISTS idx_post_variants_platform   ON post_variants(platform);
CREATE INDEX IF NOT EXISTS idx_post_stats_variant_id    ON post_stats(post_variant_id);
CREATE INDEX IF NOT EXISTS idx_post_stats_client_id     ON post_stats(client_id);
CREATE INDEX IF NOT EXISTS idx_schedules_scheduled_at   ON schedules(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_client_strategy_client   ON client_strategy(client_id);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_client ON platform_accounts(client_id);

COMMIT;
