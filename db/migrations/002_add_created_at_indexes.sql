-- Migration: 002_add_created_at_indexes
-- Created: 2026-03-19

BEGIN;

CREATE INDEX IF NOT EXISTS idx_posts_created_at   ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);

COMMIT;
