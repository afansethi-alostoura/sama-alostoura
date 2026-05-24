// ── QuickBooks Online API TypeScript Types ──────────────────

export interface QBTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number                  // seconds until access_token expires (3600)
  x_refresh_token_expires_in: number  // seconds until refresh_token expires (~100 days)
  realm_id: string                    // QBO company ID
  created_at: number                  // Unix ms timestamp of when tokens were issued
}

export interface QBInvoice {
  Id: string
  DocNumber: string
  TxnDate: string        // YYYY-MM-DD
  DueDate?: string
  TotalAmt: number
  Balance: number        // 0 = fully paid
  CustomerRef: { value: string; name: string }
  CurrencyRef?: { value: string; name: string }
  PrivateNote?: string
  LinkedTxn?: Array<{ TxnId: string; TxnType: string }>
  Line?: QBInvoiceLine[]
  EmailStatus?: string
  BillEmail?: { Address: string }
}

export interface QBInvoiceLine {
  Id?: string
  LineNum?: number
  Description?: string
  Amount: number
  DetailType: string
  SalesItemLineDetail?: {
    ItemRef: { value: string; name: string }
    UnitPrice: number
    Qty: number
  }
}

export interface QBPayment {
  Id: string
  PaymentRefNum?: string
  TxnDate: string
  TotalAmt: number
  CustomerRef: { value: string; name: string }
  CurrencyRef?: { value: string; name: string }
  DepositToAccountRef?: { value: string; name: string }
  Line?: Array<{
    Amount: number
    LinkedTxn: Array<{ TxnId: string; TxnType: string }>
  }>
}

export interface QBCustomer {
  Id: string
  DisplayName: string
  CompanyName?: string
  Balance: number
  CurrencyRef?: { value: string; name: string }
  PrimaryPhone?: { FreeFormNumber: string }
  PrimaryEmailAddr?: { Address: string }
  BillAddr?: {
    Line1?: string; City?: string; Country?: string
  }
}

export interface QBCompanyInfo {
  CompanyName: string
  LegalName?: string
  Country: string
  FiscalYearStartMonth: string
  CompanyAddr?: { City?: string; Country?: string }
  SupportedLanguages?: string
}

export interface QBQueryResponse<T> {
  QueryResponse: {
    [key: string]: T[] | number | undefined
    maxResults: number
    startPosition: number
    totalCount?: number
  }
  time: string
}

// ── Cached snapshot stored in .qb-data.json ─────────────────
export interface QBSnapshot {
  realm_id: string
  company_name: string
  synced_at: string           // ISO timestamp
  invoices:  QBInvoice[]
  payments:  QBPayment[]
  customers: QBCustomer[]
}
