-- ============================================================
--  Sama Alostoura — Seed Data
--  Run AFTER schema.sql. Seeds all 5 active projects.
-- ============================================================

-- ── CLIENTS ─────────────────────────────────────────────────
INSERT INTO clients (id, name, phone, email, nationality, location, type) VALUES
  ('00000001-0000-0000-0000-000000000001', 'Khalid Al Mansouri',  '+971-50-123-4567', NULL, 'UAE', 'Al Khawaneej, Dubai', 'owner'),
  ('00000001-0000-0000-0000-000000000002', 'Rashid Al Rashidi',   '+971-55-234-5678', NULL, 'UAE', 'Mirdif, Dubai',       'owner'),
  ('00000001-0000-0000-0000-000000000003', 'Mohamed Al Qubaisi',  '+971-50-345-6789', NULL, 'UAE', 'Al Warqa, Dubai',     'owner'),
  ('00000001-0000-0000-0000-000000000004', 'Saeed Al Falasi',     '+971-52-456-7890', NULL, 'UAE', 'Nad Al Sheba, Dubai', 'owner'),
  ('00000001-0000-0000-0000-000000000005', 'Hamdan Al Nasser',    '+971-56-567-8901', NULL, 'UAE', 'Muhaisnah, Dubai',    'owner')
ON CONFLICT (id) DO NOTHING;

-- ── PROJECTS ─────────────────────────────────────────────────
INSERT INTO projects (id, name, client_id, type, location, contract_value, received_amount, progress_percent, current_stage, start_date, expected_completion, status) VALUES
  ('00000002-0000-0000-0000-000000000001', 'Khalid',    '00000001-0000-0000-0000-000000000001', 'villa',       'Al Khawaneej, Dubai',  1250000, 520000, 75,  'MEP Works & Internal Finishes', '2024-01-15', '2024-12-31', 'active'),
  ('00000002-0000-0000-0000-000000000002', 'Al Rashidi','00000001-0000-0000-0000-000000000002', 'villa',       'Mirdif, Dubai',        1450000, 280000, 30,  'Superstructure — Ground Floor', '2024-06-01', '2025-06-30', 'active'),
  ('00000002-0000-0000-0000-000000000003', 'Al Qubaisi','00000001-0000-0000-0000-000000000003', 'villa',       'Al Warqa, Dubai',       980000, 820000, 92,  'Snagging & External Works',     '2023-09-01', '2024-11-30', 'active'),
  ('00000002-0000-0000-0000-000000000004', 'Al Falasi', '00000001-0000-0000-0000-000000000004', 'renovation',  'Nad Al Sheba, Dubai',   320000,  48000, 15,  'Demolition & Prep Works',       '2024-10-01', '2025-02-28', 'active'),
  ('00000002-0000-0000-0000-000000000005', 'Al Nasser', '00000001-0000-0000-0000-000000000005', 'renovation',  'Muhaisnah, Dubai',      285000, 256500,100,  'Completed — Handed Over',       '2024-05-01', '2024-09-30', 'completed')
ON CONFLICT (id) DO NOTHING;

-- ── PAYMENT SCHEDULE: KHALID ────────────────────────────────
INSERT INTO payment_schedule (project_id, payment_number, source, amount, trigger_condition, status, applied_date, received_date) VALUES
  ('00000002-0000-0000-0000-000000000001', 1, 'MBHRE', 100000, 'Site Preparation & Mobilisation',             'received', '2024-01-18', '2024-01-25'),
  ('00000002-0000-0000-0000-000000000001', 2, 'MBHRE', 180000, 'Foundation & Ground Slab Complete',            'received', '2024-03-10', '2024-03-20'),
  ('00000002-0000-0000-0000-000000000001', 3, 'MBHRE', 240000, 'Superstructure (Ground + First Floor) Complete','received', '2024-05-25', '2024-06-05'),
  ('00000002-0000-0000-0000-000000000001', 4, 'MBHRE', 200000, 'Blockwork & Rough MEP Complete — 75% Progress','applied',  '2024-10-15', NULL),
  ('00000002-0000-0000-0000-000000000001', 5, 'MBHRE', 200000, 'Internal Finishes: Tiling, Plaster, AC',       'pending',  NULL,         NULL),
  ('00000002-0000-0000-0000-000000000001', 6, 'MBHRE', 200000, 'External Works, Aluminium, Fit-out',           'pending',  NULL,         NULL),
  ('00000002-0000-0000-0000-000000000001', 7, 'MBHRE', 130000, 'Final Completion & Handover',                  'pending',  NULL,         NULL);

-- ── PAYMENT SCHEDULE: AL RASHIDI ───────────────────────────
INSERT INTO payment_schedule (project_id, payment_number, source, amount, trigger_condition, status, applied_date, received_date) VALUES
  ('00000002-0000-0000-0000-000000000002', 1, 'MBHRE', 145000, 'Site Preparation & Mobilisation',   'received', '2024-06-05', '2024-06-15'),
  ('00000002-0000-0000-0000-000000000002', 2, 'MBHRE', 135000, 'Foundation & Ground Slab Complete', 'received', '2024-08-20', '2024-09-01'),
  ('00000002-0000-0000-0000-000000000002', 3, 'MBHRE', 217500, 'Superstructure Ground Floor',       'pending',  NULL,         NULL),
  ('00000002-0000-0000-0000-000000000002', 4, 'MBHRE', 217500, 'Superstructure First Floor & Roof', 'pending',  NULL,         NULL),
  ('00000002-0000-0000-0000-000000000002', 5, 'MBHRE', 290000, 'MEP & Internal Finishes',           'pending',  NULL,         NULL),
  ('00000002-0000-0000-0000-000000000002', 6, 'MBHRE', 290000, 'External & Completion',             'pending',  NULL,         NULL),
  ('00000002-0000-0000-0000-000000000002', 7, 'MBHRE', 155000, 'Final Handover',                    'pending',  NULL,         NULL);

-- ── WORK STAGES: KHALID (22 sections) ──────────────────────
INSERT INTO work_stages (project_id, section_no, section_name, description, status, completion_date) VALUES
  ('00000002-0000-0000-0000-000000000001',  1, 'Preliminary Works',         'Site clearance, hoarding, temp facilities',         'complete',     '2024-02-01'),
  ('00000002-0000-0000-0000-000000000001',  2, 'Excavation & Backfilling',  'Cut to formation level, backfill around footings',  'complete',     '2024-02-20'),
  ('00000002-0000-0000-0000-000000000001',  3, 'Foundation',                'Pad footings, ground beams, blinding',              'complete',     '2024-03-10'),
  ('00000002-0000-0000-0000-000000000001',  4, 'Ground Floor Slab',         'RC slab on ground with mesh reinforcement',         'complete',     '2024-03-25'),
  ('00000002-0000-0000-0000-000000000001',  5, 'Superstructure — G Floor',  'Columns, beams, first floor slab',                  'complete',     '2024-05-01'),
  ('00000002-0000-0000-0000-000000000001',  6, 'Superstructure — 1st Floor','Columns, beams, roof slab',                         'complete',     '2024-05-25'),
  ('00000002-0000-0000-0000-000000000001',  7, 'Waterproofing',             'Roof and wet area waterproofing',                   'complete',     '2024-06-15'),
  ('00000002-0000-0000-0000-000000000001',  8, 'Block Works',               'External & internal block walls — 95% done',        'in_progress',  NULL),
  ('00000002-0000-0000-0000-000000000001',  9, 'Plumbing Rough-In',         'Main pipes, drains, risers — 60% done',             'in_progress',  NULL),
  ('00000002-0000-0000-0000-000000000001', 10, 'Electrical Rough-In',       'Conduits, DB boxes, cabling — 55% done',            'in_progress',  NULL),
  ('00000002-0000-0000-0000-000000000001', 11, 'AC — Ducting',              'Central AC ducting — NOT YET STARTED (BLOCKER)',    'pending',      NULL),
  ('00000002-0000-0000-0000-000000000001', 12, 'Plastering',                'Internal plaster on walls and soffits',             'pending',      NULL),
  ('00000002-0000-0000-0000-000000000001', 13, 'Internal Tiling',           'Floor and wall tiles — all areas',                  'pending',      NULL),
  ('00000002-0000-0000-0000-000000000001', 14, 'Aluminium Works',           'Windows, doors, facades',                           'pending',      NULL),
  ('00000002-0000-0000-0000-000000000001', 15, 'Carpentry',                 'Built-in wardrobes, kitchen carcass, doors',        'pending',      NULL),
  ('00000002-0000-0000-0000-000000000001', 16, 'Sanitary Fittings',         'WCs, basins, showers, baths',                       'pending',      NULL),
  ('00000002-0000-0000-0000-000000000001', 17, 'Painting',                  'Internal and external paint',                       'pending',      NULL),
  ('00000002-0000-0000-0000-000000000001', 18, 'DEWA Connection',           'Electricity & water permanent connection — URGENT', 'pending',      NULL),
  ('00000002-0000-0000-0000-000000000001', 19, 'External Works',            'Boundary wall, driveway, car porch',                'pending',      NULL),
  ('00000002-0000-0000-0000-000000000001', 20, 'Landscaping',               'Garden, planters, irrigation',                      'pending',      NULL),
  ('00000002-0000-0000-0000-000000000001', 21, 'Snagging',                  'Full defect inspection and rectification',          'pending',      NULL),
  ('00000002-0000-0000-0000-000000000001', 22, 'Handover',                  'Final handover to client with DM completion cert',  'pending',      NULL);

-- ── DOCUMENTS: KHALID ───────────────────────────────────────
INSERT INTO documents (project_id, type, title, issue_date, expiry_date, status) VALUES
  ('00000002-0000-0000-0000-000000000001', 'contract', 'Main Construction Contract — Khalid',      '2024-01-10', NULL,         'active'),
  ('00000002-0000-0000-0000-000000000001', 'permit',   'Dubai Municipality Building Permit',        '2024-01-12', '2025-06-30', 'active'),
  ('00000002-0000-0000-0000-000000000001', 'approval', 'MBHRE Approval Letter — AED 1,250,000',     '2024-01-05', NULL,         'active'),
  ('00000002-0000-0000-0000-000000000001', 'BOQ',      'Bill of Quantities v1.2',                   '2024-01-08', NULL,         'active'),
  ('00000002-0000-0000-0000-000000000001', 'permit',   'Trade License — Sama Alostoura',            '2024-03-01', '2025-03-31', 'active');

-- ── DAILY REPORTS: KHALID (last 3) ─────────────────────────
INSERT INTO daily_reports (project_id, report_date, work_done, workers_count, issues, materials_used, tomorrow_plan, reported_by) VALUES
  ('00000002-0000-0000-0000-000000000001', '2024-11-15',
   'Block works: remaining internal walls 90% complete. Plumbing rough-in continued on ground floor bathrooms.',
   12, 'Cement delivery delayed by 1 day — contractor notified. AC subcontractor still not confirmed start date.',
   '200 blocks, 5 bags cement, PVC pipes 110mm x 6m (8 lengths)',
   'Complete final block course. Continue plumbing rough-in 1st floor. Chase AC subcontractor.',
   'Engineer Mahmoud'),
  ('00000002-0000-0000-0000-000000000001', '2024-11-14',
   'Block works: external walls completed. Internal partition walls 80% done. Electrical conduits on ground floor.',
   10, 'Minor: one window frame measurement issue — flagged to aluminium supplier.',
   '350 blocks, 8 bags cement, PVC conduits 25mm (20 lengths)',
   'Continue internal block works. Start 1st floor plumbing rough-in.',
   'Engineer Mahmoud'),
  ('00000002-0000-0000-0000-000000000001', '2024-11-13',
   'Plumbing rough-in 1st floor bathrooms — drainage completed. Electrical DB boxes installed on both floors.',
   8, 'None.',
   'PVC pipes 75mm (10 lengths), electrical DB boxes x4',
   'Continue plumbing. Block works: ground floor partitions.',
   'Engineer Mahmoud');

-- ── STAFF ───────────────────────────────────────────────────
INSERT INTO staff (name, role, phone, visa_expiry, emirates_id_expiry, salary, join_date, status) VALUES
  ('Ahmed Al Hashimi',  'General Manager',      '+971-50-100-0001', '2026-08-15', '2026-08-15', 15000, '2020-01-01', 'active'),
  ('Mahmoud Hassan',    'Site Engineer',         '+971-55-200-0002', '2024-12-31', '2024-12-31',  8000, '2022-03-01', 'active'),
  ('Ravi Kumar',        'Foreman',               '+971-52-300-0003', '2025-06-30', '2025-06-30',  4500, '2021-06-01', 'active'),
  ('Santhosh Menon',    'Accountant',            '+971-50-400-0004', '2025-09-20', '2025-09-20',  6000, '2022-01-15', 'active'),
  ('Ali Mohammed',      'Procurement Officer',   '+971-56-500-0005', '2025-04-10', '2025-04-10',  5500, '2023-02-01', 'active'),
  ('Deepak Nair',       'Document Controller',   '+971-54-600-0006', '2026-01-25', '2026-01-25',  4000, '2023-07-01', 'active'),
  ('Pradeep Thomas',    'Site Labourer',         '+971-52-700-0007', '2025-02-28', '2025-02-28',  1800, '2022-11-01', 'active');

-- ── SUPPLIERS ───────────────────────────────────────────────
INSERT INTO suppliers (name, contact, phone, materials_supplied, rating, payment_terms) VALUES
  ('Al Futtaim Building Materials', 'Omar Al Futtaim', '+971-4-333-1111', 'Cement, blocks, sand, aggregate', 5, 'Net 30'),
  ('Danway Electricals LLC',        'Sanjay Mehta',    '+971-4-444-2222', 'Electrical cables, fittings, DBs', 4, 'Net 15'),
  ('Emirates Tiles & Ceramics',     'Khalifa Saeed',   '+971-4-555-3333', 'Floor & wall tiles',               4, 'Net 30'),
  ('Gulf Aluminium Works',          'Hassan Khalil',   '+971-4-666-4444', 'Windows, doors, facades',          4, 'Net 45'),
  ('Dubai Paints',                  'Rajesh Kumar',    '+971-4-777-5555', 'Internal & external paint',        3, 'Net 15');
