-- ============================================================
--  Migration: Add QuickBooks Classes & Expenses support
--  Run in Supabase SQL Editor
-- ============================================================

-- Step 1: Create qb_snapshot table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS qb_snapshot (
  id           INTEGER PRIMARY KEY DEFAULT 1,
  realm_id     TEXT,
  company_name TEXT,
  synced_at    TEXT,
  invoices     JSONB DEFAULT '[]'::jsonb,
  payments     JSONB DEFAULT '[]'::jsonb,
  customers    JSONB DEFAULT '[]'::jsonb,
  classes      JSONB DEFAULT '[]'::jsonb,
  purchases    JSONB DEFAULT '[]'::jsonb,
  bills        JSONB DEFAULT '[]'::jsonb
);

-- Step 2: Add new columns to existing qb_snapshot table (safe — does nothing if already there)
ALTER TABLE qb_snapshot
  ADD COLUMN IF NOT EXISTS classes   JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS purchases JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bills     JSONB DEFAULT '[]'::jsonb;

-- Step 3: GIN indexes for faster JSONB queries on classes/purchases/bills
CREATE INDEX IF NOT EXISTS idx_qb_snapshot_classes
  ON qb_snapshot USING GIN (classes);

CREATE INDEX IF NOT EXISTS idx_qb_snapshot_purchases
  ON qb_snapshot USING GIN (purchases);

CREATE INDEX IF NOT EXISTS idx_qb_snapshot_bills
  ON qb_snapshot USING GIN (bills);
