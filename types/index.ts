export type ProjectType   = 'villa' | 'renovation' | 'commercial'
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled'
export type PaymentStatus = 'pending' | 'applied' | 'received'
export type PaymentSource = 'MBHRE' | 'Owner'
export type WorkStatus    = 'pending' | 'in_progress' | 'complete'
export type DocumentType  = 'contract' | 'permit' | 'BOQ' | 'drawing' | 'approval' | 'other'
export type StaffStatus   = 'active' | 'inactive'

export interface Client {
  id: string
  name: string
  phone: string | null
  email: string | null
  nationality: string
  location: string | null
  type: 'owner' | 'lead'
  created_at: string
}

export interface Project {
  id: string
  name: string
  client_id: string
  type: ProjectType
  location: string | null
  contract_value: number
  received_amount: number
  progress_percent: number
  current_stage: string | null
  start_date: string | null
  expected_completion: string | null
  status: ProjectStatus
  notes: string | null
  created_at: string
  updated_at: string
  client?: Client
}

export interface PaymentSchedule {
  id: string
  project_id: string
  payment_number: number
  source: PaymentSource
  amount: number
  trigger_condition: string
  status: PaymentStatus
  applied_date: string | null
  received_date: string | null
  notes: string | null
}

export interface WorkStage {
  id: string
  project_id: string
  section_no: number
  section_name: string
  item_code: string | null
  description: string | null
  status: WorkStatus
  completion_date: string | null
  notes: string | null
}

export interface Document {
  id: string
  project_id: string
  type: DocumentType
  title: string
  file_url: string | null
  issue_date: string | null
  expiry_date: string | null
  status: string
}

export interface DailyReport {
  id: string
  project_id: string
  report_date: string
  work_done: string
  workers_count: number
  issues: string | null
  materials_used: string | null
  tomorrow_plan: string | null
  reported_by: string
}

export interface Staff {
  id: string
  name: string
  role: string
  phone: string | null
  visa_expiry: string | null
  emirates_id_expiry: string | null
  salary: number
  join_date: string | null
  status: StaffStatus
}

export interface Supplier {
  id: string
  name: string
  contact: string | null
  phone: string | null
  email: string | null
  materials_supplied: string | null
  rating: number | null
  payment_terms: string | null
}
