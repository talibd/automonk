-- Migration: 003_add_client_logo
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url TEXT;
