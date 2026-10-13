/**
 * Full Supabase → Railway migration.
 * Run: node scripts/migrate-all-tables.js
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY, RAILWAY_URL env vars
 *           OR hardcode them below for one-time run.
 */
const { Pool } = require('pg')

const RAILWAY_URL  = 'postgresql://postgres:CrobOtpBopBORqtKKOpCZpayokhaXMXX@iriguchi.proxy.rlwy.net:48219/railway'
// Get Supabase creds from the Vercel env (we'll pass via command line)
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Usage: SUPABASE_URL=https://... SUPABASE_KEY=sk_... node scripts/migrate-all-tables.js')
  process.exit(1)
}

const pool = new Pool({ connectionString: RAILWAY_URL, ssl: { rejectUnauthorized: false } })

async function supabaseFetch(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) {
    const txt = await res.text()
    console.warn(`  ⚠ ${table}: ${res.status} ${txt.slice(0, 100)}`)
    return []
  }
  return res.json()
}

async function run() {
  const client = await pool.connect()
  try {
    // ── Create missing tables ─────────────────────────────────────────────
    console.log('Creating tables...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_boq (
        id             TEXT PRIMARY KEY,
        project_number TEXT,
        project_name   TEXT,
        area           TEXT,
        owner          TEXT,
        contractor     TEXT,
        items          JSONB DEFAULT '[]',
        created_at     TIMESTAMPTZ DEFAULT NOW(),
        updated_at     TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS renovation_boq (
        id          TEXT PRIMARY KEY,
        project_id  TEXT,
        title       TEXT,
        items       JSONB DEFAULT '[]',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS mbhre_boq (
        id          TEXT PRIMARY KEY,
        project_id  TEXT,
        title       TEXT,
        items       JSONB DEFAULT '[]',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS mbhre_breakdown_boq (
        id          TEXT PRIMARY KEY,
        project_id  TEXT,
        title       TEXT,
        items       JSONB DEFAULT '[]',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS project_documents (
        id          TEXT PRIMARY KEY,
        project_id  TEXT,
        folder      TEXT,
        name        TEXT,
        url         TEXT,
        size        BIGINT,
        type        TEXT,
        uploaded_at TIMESTAMPTZ DEFAULT NOW(),
        metadata    JSONB DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS procurement_prs (
        id          TEXT PRIMARY KEY,
        project_id  TEXT,
        data        JSONB DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id           BIGSERIAL PRIMARY KEY,
        project_id   TEXT,
        project_name TEXT,
        sender_name  TEXT,
        action_type  TEXT,
        ai_summary   TEXT,
        auto_applied BOOLEAN DEFAULT FALSE,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS qb_snapshot (
        id         INTEGER PRIMARY KEY DEFAULT 1,
        rak_bank   JSONB,
        synced_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `)
    console.log('Tables created ✅')

    // ── Migrate each table ────────────────────────────────────────────────
    const tables = [
      { name: 'company_boq',          pk: 'id',    jsonb: ['items'] },
      { name: 'renovation_boq',        pk: 'id',    jsonb: ['items'] },
      { name: 'mbhre_boq',             pk: 'id',    jsonb: ['items'] },
      { name: 'mbhre_breakdown_boq',   pk: 'id',    jsonb: ['items'] },
      { name: 'project_documents',     pk: 'id',    jsonb: ['metadata'] },
      { name: 'procurement_prs',       pk: 'id',    jsonb: ['data'] },
      { name: 'whatsapp_messages',     pk: null,    jsonb: [] },
    ]

    for (const t of tables) {
      console.log(`\nMigrating ${t.name}...`)
      const rows = await supabaseFetch(t.name)
      console.log(`  ${rows.length} rows from Supabase`)
      if (!rows.length) continue

      let inserted = 0
      for (const row of rows) {
        try {
          const cols   = Object.keys(row)
          const vals   = cols.map((c, i) => `$${i + 1}`)
          const values = cols.map(c => {
            const v = row[c]
            if (t.jsonb.includes(c) && v !== null && typeof v !== 'string')
              return JSON.stringify(v)
            return v
          })

          if (t.pk) {
            const updates = cols.filter(c => c !== t.pk).map((c, i) => `${c} = $${cols.indexOf(c) + 1}`)
            await client.query(
              `INSERT INTO ${t.name} (${cols.join(', ')}) VALUES (${vals})
               ON CONFLICT (${t.pk}) DO UPDATE SET ${updates.join(', ')}`,
              values
            )
          } else {
            await client.query(
              `INSERT INTO ${t.name} (${cols.filter(c => c !== 'id').join(', ')})
               VALUES (${cols.filter(c => c !== 'id').map((_, i) => `$${i + 1}`)})`,
              cols.filter(c => c !== 'id').map(c => row[c])
            )
          }
          inserted++
        } catch (err) {
          console.warn(`  ⚠ row error: ${err.message.slice(0, 80)}`)
        }
      }
      console.log(`  ✅ ${inserted}/${rows.length} rows inserted`)
    }

    // ── Final counts ──────────────────────────────────────────────────────
    console.log('\n── Railway table counts ──')
    for (const t of [...tables]) {
      const { rows } = await client.query(`SELECT COUNT(*) FROM ${t.name}`)
      console.log(`  ${t.name}: ${rows[0].count}`)
    }

  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => { console.error('FATAL:', err.message); process.exit(1) })
