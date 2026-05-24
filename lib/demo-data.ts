import type { Project, Client, PaymentSchedule, WorkStage, Document, DailyReport, Staff } from '@/types'

// Fixed demo UUIDs matching seed.sql
const KHALID_ID    = '00000002-0000-0000-0000-000000000001'
const RASHIDI_ID   = '00000002-0000-0000-0000-000000000002'
const QUBAISI_ID   = '00000002-0000-0000-0000-000000000003'
const FALASI_ID    = '00000002-0000-0000-0000-000000000004'
const NASSER_ID    = '00000002-0000-0000-0000-000000000005'

export const DEMO_PROJECTS: Project[] = [
  {
    id: KHALID_ID, name: 'Khalid', client_id: '00000001-0000-0000-0000-000000000001',
    type: 'villa', location: 'Al Khawaneej, Dubai',
    contract_value: 1250000, received_amount: 520000, progress_percent: 75,
    current_stage: 'MEP Works & Internal Finishes',
    start_date: '2024-01-15', expected_completion: '2024-12-31',
    status: 'active', notes: null,
    created_at: '2024-01-10T00:00:00Z', updated_at: '2024-11-15T00:00:00Z',
    client: { id: '00000001-0000-0000-0000-000000000001', name: 'Khalid Al Mansouri',
      phone: '+971-50-123-4567', email: null, nationality: 'UAE',
      location: 'Al Khawaneej', type: 'owner', created_at: '2024-01-10T00:00:00Z' },
  },
  {
    id: RASHIDI_ID, name: 'Al Rashidi', client_id: '00000001-0000-0000-0000-000000000002',
    type: 'villa', location: 'Mirdif, Dubai',
    contract_value: 1450000, received_amount: 280000, progress_percent: 30,
    current_stage: 'Superstructure — Ground Floor',
    start_date: '2024-06-01', expected_completion: '2025-06-30',
    status: 'active', notes: null,
    created_at: '2024-06-01T00:00:00Z', updated_at: '2024-11-10T00:00:00Z',
    client: { id: '00000001-0000-0000-0000-000000000002', name: 'Rashid Al Rashidi',
      phone: '+971-55-234-5678', email: null, nationality: 'UAE',
      location: 'Mirdif', type: 'owner', created_at: '2024-06-01T00:00:00Z' },
  },
  {
    id: QUBAISI_ID, name: 'Al Qubaisi', client_id: '00000001-0000-0000-0000-000000000003',
    type: 'villa', location: 'Al Warqa, Dubai',
    contract_value: 980000, received_amount: 820000, progress_percent: 92,
    current_stage: 'Snagging & External Works',
    start_date: '2023-09-01', expected_completion: '2024-11-30',
    status: 'active', notes: null,
    created_at: '2023-09-01T00:00:00Z', updated_at: '2024-11-12T00:00:00Z',
    client: { id: '00000001-0000-0000-0000-000000000003', name: 'Mohamed Al Qubaisi',
      phone: '+971-50-345-6789', email: null, nationality: 'UAE',
      location: 'Al Warqa', type: 'owner', created_at: '2023-09-01T00:00:00Z' },
  },
  {
    id: FALASI_ID, name: 'Al Falasi', client_id: '00000001-0000-0000-0000-000000000004',
    type: 'renovation', location: 'Nad Al Sheba, Dubai',
    contract_value: 320000, received_amount: 48000, progress_percent: 15,
    current_stage: 'Demolition & Prep Works',
    start_date: '2024-10-01', expected_completion: '2025-02-28',
    status: 'active', notes: null,
    created_at: '2024-10-01T00:00:00Z', updated_at: '2024-11-01T00:00:00Z',
    client: { id: '00000001-0000-0000-0000-000000000004', name: 'Saeed Al Falasi',
      phone: '+971-52-456-7890', email: null, nationality: 'UAE',
      location: 'Nad Al Sheba', type: 'owner', created_at: '2024-10-01T00:00:00Z' },
  },
  {
    id: NASSER_ID, name: 'Al Nasser', client_id: '00000001-0000-0000-0000-000000000005',
    type: 'renovation', location: 'Muhaisnah, Dubai',
    contract_value: 285000, received_amount: 256500, progress_percent: 100,
    current_stage: 'Completed — Handed Over',
    start_date: '2024-05-01', expected_completion: '2024-09-30',
    status: 'completed', notes: null,
    created_at: '2024-05-01T00:00:00Z', updated_at: '2024-09-30T00:00:00Z',
    client: { id: '00000001-0000-0000-0000-000000000005', name: 'Hamdan Al Nasser',
      phone: '+971-56-567-8901', email: null, nationality: 'UAE',
      location: 'Muhaisnah', type: 'owner', created_at: '2024-05-01T00:00:00Z' },
  },
]

export const DEMO_PAYMENT_SCHEDULE: PaymentSchedule[] = [
  { id: 'pay-01', project_id: KHALID_ID, payment_number: 1, source: 'MBHRE', amount: 100000,  trigger_condition: 'Site Preparation & Mobilisation',              status: 'received', applied_date: '2024-01-18', received_date: '2024-01-25', notes: null },
  { id: 'pay-02', project_id: KHALID_ID, payment_number: 2, source: 'MBHRE', amount: 180000,  trigger_condition: 'Foundation & Ground Slab Complete',             status: 'received', applied_date: '2024-03-10', received_date: '2024-03-20', notes: null },
  { id: 'pay-03', project_id: KHALID_ID, payment_number: 3, source: 'MBHRE', amount: 240000,  trigger_condition: 'Superstructure (Ground + First Floor) Complete', status: 'received', applied_date: '2024-05-25', received_date: '2024-06-05', notes: null },
  { id: 'pay-04', project_id: KHALID_ID, payment_number: 4, source: 'MBHRE', amount: 200000,  trigger_condition: 'Blockwork & Rough MEP Complete — 75% Progress',  status: 'applied',  applied_date: '2024-10-15', received_date: null,         notes: 'MBHRE inspection completed — awaiting payment release' },
  { id: 'pay-05', project_id: KHALID_ID, payment_number: 5, source: 'MBHRE', amount: 200000,  trigger_condition: 'Internal Finishes: Tiling, Plaster, AC',          status: 'pending',  applied_date: null,         received_date: null,         notes: null },
  { id: 'pay-06', project_id: KHALID_ID, payment_number: 6, source: 'MBHRE', amount: 200000,  trigger_condition: 'External Works, Aluminium, Fit-out',              status: 'pending',  applied_date: null,         received_date: null,         notes: null },
  { id: 'pay-07', project_id: KHALID_ID, payment_number: 7, source: 'MBHRE', amount: 130000,  trigger_condition: 'Final Completion & Handover',                     status: 'pending',  applied_date: null,         received_date: null,         notes: null },
]

export const DEMO_WORK_STAGES: WorkStage[] = [
  { id: 'ws-01', project_id: KHALID_ID, section_no: 1,  section_name: 'Preliminary Works',        item_code: null, description: 'Site clearance, hoarding, temp facilities',        status: 'complete',     completion_date: '2024-02-01', notes: null },
  { id: 'ws-02', project_id: KHALID_ID, section_no: 2,  section_name: 'Excavation & Backfilling', item_code: null, description: 'Cut to formation level, backfill around footings',  status: 'complete',     completion_date: '2024-02-20', notes: null },
  { id: 'ws-03', project_id: KHALID_ID, section_no: 3,  section_name: 'Foundation',               item_code: null, description: 'Pad footings, ground beams, blinding',              status: 'complete',     completion_date: '2024-03-10', notes: null },
  { id: 'ws-04', project_id: KHALID_ID, section_no: 4,  section_name: 'Ground Floor Slab',        item_code: null, description: 'RC slab on ground with mesh reinforcement',          status: 'complete',     completion_date: '2024-03-25', notes: null },
  { id: 'ws-05', project_id: KHALID_ID, section_no: 5,  section_name: 'Superstructure G Floor',   item_code: null, description: 'Columns, beams, first floor slab',                  status: 'complete',     completion_date: '2024-05-01', notes: null },
  { id: 'ws-06', project_id: KHALID_ID, section_no: 6,  section_name: 'Superstructure 1st Floor', item_code: null, description: 'Columns, beams, roof slab',                          status: 'complete',     completion_date: '2024-05-25', notes: null },
  { id: 'ws-07', project_id: KHALID_ID, section_no: 7,  section_name: 'Waterproofing',            item_code: null, description: 'Roof and wet area waterproofing',                    status: 'complete',     completion_date: '2024-06-15', notes: null },
  { id: 'ws-08', project_id: KHALID_ID, section_no: 8,  section_name: 'Block Works',              item_code: null, description: 'External & internal block walls — 95% done',        status: 'in_progress',  completion_date: null,         notes: null },
  { id: 'ws-09', project_id: KHALID_ID, section_no: 9,  section_name: 'Plumbing Rough-In',        item_code: null, description: 'Main pipes, drains, risers — 60% done',             status: 'in_progress',  completion_date: null,         notes: null },
  { id: 'ws-10', project_id: KHALID_ID, section_no: 10, section_name: 'Electrical Rough-In',      item_code: null, description: 'Conduits, DB boxes, cabling — 55% done',            status: 'in_progress',  completion_date: null,         notes: null },
  { id: 'ws-11', project_id: KHALID_ID, section_no: 11, section_name: 'AC — Ducting',             item_code: null, description: 'Central AC ducting — NOT YET STARTED (BLOCKER)',    status: 'pending',      completion_date: null,         notes: '⚠️ Call AC subcontractor today' },
  { id: 'ws-12', project_id: KHALID_ID, section_no: 12, section_name: 'Plastering',               item_code: null, description: 'Internal plaster on walls and soffits',             status: 'pending',      completion_date: null,         notes: null },
  { id: 'ws-13', project_id: KHALID_ID, section_no: 13, section_name: 'Internal Tiling',          item_code: null, description: 'Floor and wall tiles — all areas',                  status: 'pending',      completion_date: null,         notes: null },
  { id: 'ws-14', project_id: KHALID_ID, section_no: 14, section_name: 'Aluminium Works',          item_code: null, description: 'Windows, doors, facades',                           status: 'pending',      completion_date: null,         notes: null },
  { id: 'ws-15', project_id: KHALID_ID, section_no: 15, section_name: 'Carpentry',                item_code: null, description: 'Built-in wardrobes, kitchen carcass, doors',        status: 'pending',      completion_date: null,         notes: null },
  { id: 'ws-16', project_id: KHALID_ID, section_no: 16, section_name: 'Sanitary Fittings',        item_code: null, description: 'WCs, basins, showers, baths',                       status: 'pending',      completion_date: null,         notes: null },
  { id: 'ws-17', project_id: KHALID_ID, section_no: 17, section_name: 'Painting',                 item_code: null, description: 'Internal and external paint',                       status: 'pending',      completion_date: null,         notes: null },
  { id: 'ws-18', project_id: KHALID_ID, section_no: 18, section_name: 'DEWA Connection',          item_code: null, description: 'Electricity & water permanent connection',           status: 'pending',      completion_date: null,         notes: '🔴 URGENT — Apply now, takes 3 weeks' },
  { id: 'ws-19', project_id: KHALID_ID, section_no: 19, section_name: 'External Works',           item_code: null, description: 'Boundary wall, driveway, car porch',                status: 'pending',      completion_date: null,         notes: null },
  { id: 'ws-20', project_id: KHALID_ID, section_no: 20, section_name: 'Landscaping',              item_code: null, description: 'Garden, planters, irrigation',                      status: 'pending',      completion_date: null,         notes: null },
  { id: 'ws-21', project_id: KHALID_ID, section_no: 21, section_name: 'Snagging',                 item_code: null, description: 'Full defect inspection and rectification',          status: 'pending',      completion_date: null,         notes: null },
  { id: 'ws-22', project_id: KHALID_ID, section_no: 22, section_name: 'Handover',                 item_code: null, description: 'Final handover with DM completion certificate',     status: 'pending',      completion_date: null,         notes: null },
]

export const DEMO_DOCUMENTS: Document[] = [
  { id: 'doc-01', project_id: KHALID_ID, type: 'contract', title: 'Main Construction Contract — Khalid',   file_url: null, issue_date: '2024-01-10', expiry_date: null,         status: 'active' },
  { id: 'doc-02', project_id: KHALID_ID, type: 'permit',   title: 'Dubai Municipality Building Permit',    file_url: null, issue_date: '2024-01-12', expiry_date: '2025-06-30', status: 'active' },
  { id: 'doc-03', project_id: KHALID_ID, type: 'approval', title: 'MBHRE Approval Letter — AED 1,250,000', file_url: null, issue_date: '2024-01-05', expiry_date: null,         status: 'active' },
  { id: 'doc-04', project_id: KHALID_ID, type: 'BOQ',      title: 'Bill of Quantities v1.2',               file_url: null, issue_date: '2024-01-08', expiry_date: null,         status: 'active' },
  { id: 'doc-05', project_id: KHALID_ID, type: 'permit',   title: 'Trade License — Sama Alostoura',        file_url: null, issue_date: '2024-03-01', expiry_date: '2025-03-31', status: 'active' },
]

export const DEMO_DAILY_REPORTS: DailyReport[] = [
  { id: 'dr-01', project_id: KHALID_ID, report_date: '2024-11-15', workers_count: 12,
    work_done: 'Block works: remaining internal walls 90% complete. Plumbing rough-in continued on ground floor bathrooms.',
    issues: 'Cement delivery delayed by 1 day. AC subcontractor still has not confirmed start date.',
    materials_used: '200 blocks, 5 bags cement, PVC pipes 110mm x 6m (8 lengths)',
    tomorrow_plan: 'Complete final block course. Continue plumbing rough-in 1st floor. Chase AC subcontractor.',
    reported_by: 'Engineer Mahmoud' },
  { id: 'dr-02', project_id: KHALID_ID, report_date: '2024-11-14', workers_count: 10,
    work_done: 'Block works: external walls completed. Internal partition walls 80% done. Electrical conduits on ground floor.',
    issues: 'Minor window frame measurement issue — flagged to aluminium supplier.',
    materials_used: '350 blocks, 8 bags cement, PVC conduits 25mm (20 lengths)',
    tomorrow_plan: 'Continue internal block works. Start 1st floor plumbing rough-in.',
    reported_by: 'Engineer Mahmoud' },
  { id: 'dr-03', project_id: KHALID_ID, report_date: '2024-11-13', workers_count: 8,
    work_done: 'Plumbing rough-in 1st floor bathrooms — drainage completed. Electrical DB boxes installed on both floors.',
    issues: null,
    materials_used: 'PVC pipes 75mm (10 lengths), electrical DB boxes x4',
    tomorrow_plan: 'Continue plumbing. Block works: ground floor partitions.',
    reported_by: 'Engineer Mahmoud' },
]

export const DEMO_STAFF: Staff[] = [
  { id: 'st-01', name: 'Ahmed Al Hashimi', role: 'General Manager',    phone: '+971-50-100-0001', visa_expiry: '2026-08-15', emirates_id_expiry: '2026-08-15', salary: 15000, join_date: '2020-01-01', status: 'active' },
  { id: 'st-02', name: 'Mahmoud Hassan',   role: 'Site Engineer',      phone: '+971-55-200-0002', visa_expiry: '2024-12-31', emirates_id_expiry: '2024-12-31', salary:  8000, join_date: '2022-03-01', status: 'active' },
  { id: 'st-03', name: 'Ravi Kumar',       role: 'Foreman',            phone: '+971-52-300-0003', visa_expiry: '2025-06-30', emirates_id_expiry: '2025-06-30', salary:  4500, join_date: '2021-06-01', status: 'active' },
  { id: 'st-04', name: 'Santhosh Menon',   role: 'Accountant',         phone: '+971-50-400-0004', visa_expiry: '2025-09-20', emirates_id_expiry: '2025-09-20', salary:  6000, join_date: '2022-01-15', status: 'active' },
  { id: 'st-05', name: 'Ali Mohammed',     role: 'Procurement Officer', phone: '+971-56-500-0005', visa_expiry: '2025-04-10', emirates_id_expiry: '2025-04-10', salary:  5500, join_date: '2023-02-01', status: 'active' },
  { id: 'st-06', name: 'Deepak Nair',      role: 'Document Controller', phone: '+971-54-600-0006', visa_expiry: '2026-01-25', emirates_id_expiry: '2026-01-25', salary:  4000, join_date: '2023-07-01', status: 'active' },
  { id: 'st-07', name: 'Pradeep Thomas',   role: 'Site Labourer',      phone: '+971-52-700-0007', visa_expiry: '2025-02-28', emirates_id_expiry: '2025-02-28', salary:  1800, join_date: '2022-11-01', status: 'active' },
]

export function getDemoProject(id: string): Project | undefined {
  return DEMO_PROJECTS.find(p => p.id === id)
}

export function getDemoPayments(projectId: string): PaymentSchedule[] {
  return DEMO_PAYMENT_SCHEDULE.filter(p => p.project_id === projectId)
}

export function getDemoWorkStages(projectId: string): WorkStage[] {
  return DEMO_WORK_STAGES.filter(w => w.project_id === projectId)
}

export function getDemoDocuments(projectId: string): Document[] {
  return DEMO_DOCUMENTS.filter(d => d.project_id === projectId)
}

export function getDemoReports(projectId: string): DailyReport[] {
  return DEMO_DAILY_REPORTS.filter(r => r.project_id === projectId)
}
