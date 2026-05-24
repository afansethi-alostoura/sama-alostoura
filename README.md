# Sama Alostoura AI Construction OS

AI-powered construction management system for Sama Alostoura Building Contracting LLC, Dubai UAE.

**Stack:** Next.js 14 · Supabase · Claude API · QuickBooks · Vercel

---

## Phase 1 Setup (Week 1–2)

### Step 1 — Install Node.js
Download and install from: https://nodejs.org (choose LTS version)

After installing, open a new terminal and verify:
```
node --version   # should show v18+ or v20+
npm --version
```

### Step 2 — Install Dependencies
```bash
cd C:\Users\pc\Documents\sama-alostoura
npm install
```

### Step 3 — Configure Environment
```bash
copy .env.local.example .env.local
```
Then open `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — from your Supabase project settings
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase project settings
- `ANTHROPIC_API_KEY` — from https://console.anthropic.com

To see the UI immediately without API keys, set `NEXT_PUBLIC_DEMO_MODE=true` (already default).

### Step 4 — Set Up Supabase Database
1. Go to https://supabase.com and create a free project
2. Go to **SQL Editor**
3. Paste and run `supabase/schema.sql` (creates all 15 tables)
4. Paste and run `supabase/seed.sql` (adds all 5 projects including Khalid)

### Step 5 — Run the App
```bash
npm run dev
```
Open http://localhost:3000

---

## What's Built (Phase 1)

| Screen | URL | Status |
|--------|-----|--------|
| CEO Dashboard | `/` | ✅ Ready |
| Projects List | `/projects` | ✅ Ready |
| Khalid Project | `/projects/00000002-0000-0000-0000-000000000001` | ✅ Ready |
| AI CEO Briefing | Button on dashboard | ✅ Ready (needs API key) |
| AI Project Manager | Button on project page | ✅ Ready (needs API key) |

## Coming Next

| Phase | Weeks | Modules |
|-------|-------|---------|
| Phase 2 | 3–4 | QuickBooks API, AI Accountant, MBHRE payment tracking |
| Phase 3 | 5–6 | Rate library (24 BOQ sections), AI Estimation Engineer, PDF output |
| Phase 4 | 7–8 | Procurement, Document Controller, Site Reports, Leads |
| Phase 5 | 9–10 | HR/Staff, Maintenance, Full testing |

---

## Project Structure

```
sama-alostoura/
├── app/
│   ├── page.tsx                    # CEO Dashboard
│   ├── projects/page.tsx           # All projects
│   ├── projects/[id]/page.tsx      # Single project view
│   └── api/agents/                 # AI agent API routes
│       ├── project-manager/
│       └── ceo-dashboard/
├── components/
│   ├── layout/sidebar.tsx
│   ├── dashboard/ceo-briefing.tsx
│   └── projects/
│       ├── payment-schedule-table.tsx
│       ├── work-stages-list.tsx
│       └── agent-briefing.tsx
├── lib/
│   ├── demo-data.ts                # All 5 projects hardcoded for demo
│   ├── anthropic.ts                # Claude API + system prompts
│   └── supabase/                   # Supabase client (browser + server)
├── types/index.ts                  # All TypeScript types
└── supabase/
    ├── schema.sql                  # All 15 database tables
    └── seed.sql                    # All 5 projects + Khalid detail
```

## The 10 AI Agents (from blueprint)

| # | Agent | Phase | Status |
|---|-------|-------|--------|
| 1 | AI Project Manager | 1 | ✅ Built |
| 2 | AI Estimation Engineer | 3 | Planned |
| 3 | AI Accountant | 2 | Planned |
| 4 | AI Procurement Officer | 4 | Planned |
| 5 | AI Follow-Up Assistant | 4 | Planned |
| 6 | AI Document Controller | 4 | Planned |
| 7 | AI Site Reporting Assistant | 4 | Planned |
| 8 | AI Maintenance Coordinator | 5 | Planned |
| 9 | AI HR & Admin | 5 | Planned |
| 10 | AI CEO Dashboard | 1 | ✅ Built |
