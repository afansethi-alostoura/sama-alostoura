-- ============================================================
--  Sama Alostoura AI Construction OS — Database Schema
--  Run this in Supabase SQL Editor first
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. CLIENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  nationality     TEXT DEFAULT 'UAE',
  location        TEXT,
  type            TEXT DEFAULT 'owner' CHECK (type IN ('owner', 'lead')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. PROJECTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  client_id           UUID REFERENCES clients(id),
  type                TEXT NOT NULL CHECK (type IN ('villa', 'renovation')),
  location            TEXT,
  contract_value      NUMERIC(12,2) NOT NULL DEFAULT 0,
  received_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  progress_percent    INTEGER DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  current_stage       TEXT,
  start_date          DATE,
  expected_completion DATE,
  status              TEXT DEFAULT 'active' CHECK (status IN ('active','on_hold','completed','cancelled')),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. PAYMENT SCHEDULE ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_schedule (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payment_number    INTEGER NOT NULL,
  source            TEXT NOT NULL CHECK (source IN ('MBHRE', 'Owner')),
  amount            NUMERIC(12,2) NOT NULL,
  trigger_condition TEXT NOT NULL,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending','applied','received')),
  applied_date      DATE,
  received_date     DATE,
  notes             TEXT
);

-- ── 4. WORK STAGES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_stages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_no      INTEGER NOT NULL,
  section_name    TEXT NOT NULL,
  item_code       TEXT,
  description     TEXT,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','complete')),
  completion_date DATE,
  notes           TEXT
);

-- ── 5. RATE LIBRARY ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_library (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_no        INTEGER NOT NULL,
  section_name      TEXT NOT NULL,
  item_code         TEXT NOT NULL,
  description       TEXT NOT NULL,
  unit              TEXT NOT NULL,
  default_rate      NUMERIC(10,2) NOT NULL,
  responsible_party TEXT,
  is_conditional    BOOLEAN DEFAULT FALSE,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. ESTIMATES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estimates (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id      UUID REFERENCES clients(id),
  project_id     UUID REFERENCES projects(id),
  total_cost     NUMERIC(12,2),
  margin_percent NUMERIC(5,2) DEFAULT 15,
  final_price    NUMERIC(12,2),
  status         TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','approved','rejected')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. ESTIMATE LINE ITEMS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS estimate_line_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id  UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  section_no   INTEGER,
  description  TEXT NOT NULL,
  unit         TEXT,
  qty          NUMERIC(10,2),
  rate         NUMERIC(10,2),
  subtotal     NUMERIC(12,2),
  needs_review BOOLEAN DEFAULT FALSE
);

-- ── 8. INVOICES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID REFERENCES projects(id),
  invoice_number  TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  issue_date      DATE,
  due_date        DATE,
  status          TEXT DEFAULT 'unpaid' CHECK (status IN ('paid','unpaid','overdue')),
  quickbooks_id   TEXT
);

-- ── 9. SUPPLIERS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  contact           TEXT,
  phone             TEXT,
  email             TEXT,
  materials_supplied TEXT,
  rating            INTEGER CHECK (rating BETWEEN 1 AND 5),
  payment_terms     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 10. PURCHASE ORDERS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID REFERENCES projects(id),
  supplier_id   UUID REFERENCES suppliers(id),
  material      TEXT NOT NULL,
  quantity      NUMERIC(10,2),
  unit          TEXT,
  unit_price    NUMERIC(10,2),
  total         NUMERIC(12,2),
  order_date    DATE,
  delivery_date DATE,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','ordered','delivered','cancelled'))
);

-- ── 11. DOCUMENTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID REFERENCES projects(id),
  type        TEXT CHECK (type IN ('contract','permit','BOQ','drawing','approval','other')),
  title       TEXT NOT NULL,
  file_url    TEXT,
  issue_date  DATE,
  expiry_date DATE,
  status      TEXT DEFAULT 'active'
);

-- ── 12. DAILY REPORTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID REFERENCES projects(id),
  report_date     DATE NOT NULL,
  work_done       TEXT NOT NULL,
  workers_count   INTEGER DEFAULT 0,
  issues          TEXT,
  materials_used  TEXT,
  tomorrow_plan   TEXT,
  reported_by     TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 13. MAINTENANCE TICKETS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_tickets (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID REFERENCES projects(id),
  issue_description TEXT NOT NULL,
  reported_date     DATE NOT NULL,
  assigned_to       TEXT,
  status            TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','closed')),
  completion_date   DATE
);

-- ── 14. STAFF ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 TEXT NOT NULL,
  role                 TEXT NOT NULL,
  phone                TEXT,
  visa_expiry          DATE,
  emirates_id_expiry   DATE,
  salary               NUMERIC(10,2) DEFAULT 0,
  join_date            DATE,
  status               TEXT DEFAULT 'active' CHECK (status IN ('active','inactive'))
);

-- ── 15. LEADS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID REFERENCES clients(id),
  source      TEXT CHECK (source IN ('whatsapp','referral','website','other')),
  raw_message TEXT,
  status      TEXT DEFAULT 'new' CHECK (status IN ('new','estimating','sent','won','lost')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_status       ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_client        ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_project        ON payment_schedule(project_id);
CREATE INDEX IF NOT EXISTS idx_work_stages_project    ON work_stages(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project       ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_project      ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_project  ON daily_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_project    ON maintenance_tickets(project_id);

-- ── UPDATED_AT TRIGGER ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
