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

// ── QuickBooks Classes ───────────────────────────────────────
export interface QBClass {
  Id:                  string
  Name:                string
  FullyQualifiedName:  string
  Active:              boolean
  SubClass?:           boolean
  ParentRef?:          { value: string; name: string }
}

// ── Purchase (expense transactions: checks, credit cards) ────
export interface QBPurchaseLine {
  Id?:          string
  Description?: string
  Amount:       number
  DetailType:   string
  AccountBasedExpenseLineDetail?: {
    AccountRef:      { value: string; name: string }
    ClassRef?:       { value: string; name: string }
    CustomerRef?:    { value: string; name: string }
    BillableStatus?: string
  }
  ItemBasedExpenseLineDetail?: {
    ItemRef:      { value: string; name: string }
    ClassRef?:    { value: string; name: string }
    CustomerRef?: { value: string; name: string }
  }
}

export interface QBPurchase {
  Id:           string
  TxnDate:      string
  TotalAmt:     number
  PaymentType:  string          // 'Cash' | 'Check' | 'CreditCard'
  AccountRef?:  { value: string; name: string }
  EntityRef?:   { value: string; name: string; type?: string }
  ClassRef?:    { value: string; name: string }  // header-level class
  PrivateNote?: string
  Line:         QBPurchaseLine[]
}

// ── Bill (vendor bills / AP transactions) ───────────────────
export interface QBBillLine {
  Id?:          string
  Description?: string
  Amount:       number
  DetailType:   string
  AccountBasedExpenseLineDetail?: {
    AccountRef:      { value: string; name: string }
    ClassRef?:       { value: string; name: string }
    CustomerRef?:    { value: string; name: string }
    BillableStatus?: string
  }
  ItemBasedExpenseLineDetail?: {
    ItemRef:      { value: string; name: string }
    ClassRef?:    { value: string; name: string }
    CustomerRef?: { value: string; name: string }
  }
}

export interface QBBill {
  Id:           string
  TxnDate:      string
  DueDate?:     string
  TotalAmt:     number
  Balance:      number
  VendorRef:    { value: string; name: string }
  ClassRef?:    { value: string; name: string }  // header-level class
  PrivateNote?: string
  Line:         QBBillLine[]
}

// ── Vendor Credit (reduces expense totals for a class) ───────────────────────
export interface QBVendorCreditLine {
  Id?:          string
  Description?: string
  Amount:       number
  DetailType:   string
  AccountBasedExpenseLineDetail?: {
    AccountRef:   { value: string; name: string }
    ClassRef?:    { value: string; name: string }
    CustomerRef?: { value: string; name: string }
  }
  ItemBasedExpenseLineDetail?: {
    ItemRef:   { value: string; name: string }
    ClassRef?: { value: string; name: string }
  }
}

export interface QBVendorCredit {
  Id:           string
  TxnDate:      string
  TotalAmt:     number
  Balance:      number
  VendorRef:    { value: string; name: string }
  ClassRef?:    { value: string; name: string }
  PrivateNote?: string
  Line:         QBVendorCreditLine[]
}

// ── Derived: per-class expense breakdown (dynamic accounts) ──
export interface QBClassExpenseRow {
  classId:   string
  className: string
  accounts:  Record<string, number>  // accountName → amount
  total:     number
}

// ── Individual expense line (for the accordion tree view) ────
export interface QBTransactionLine {
  txnId:       string
  lineId:      string         // txnId + lineNum for uniqueness
  txnDate:     string         // YYYY-MM-DD
  vendor:      string
  accountName: string
  amount:      number         // negative for vendor credits
  type:        'purchase' | 'bill' | 'vendor_credit'
  paymentType: string         // 'Cash' | 'Check' | 'CreditCard' | 'Bill' | 'Vendor Credit'
  note:        string         // private note or line description
}

// ── Class accordion group (class → sorted transactions) ──────
export interface QBClassGroup {
  classId:      string
  className:    string
  total:        number
  txnCount:     number        // number of line items
  accountTotals: Record<string, number>  // accountName → subtotal
  transactions: QBTransactionLine[]      // sorted date desc
}

// ── Chart of Accounts entry ───────────────────────────────────────────────────
export interface QBAccount {
  Id:                  string
  Name:                string
  FullyQualifiedName:  string
  AccountType:         string   // 'Bank' | 'Expense' | 'Income' | etc.
  AccountSubType?:     string
  CurrentBalance?:     number
  CurrencyRef?:        { value: string; name: string }
  Active:              boolean
}

// ── A single line from the General Ledger report for the Alostoura account ───
export interface QBAlostouraTransaction {
  txnDate:  string   // YYYY-MM-DD
  txnType:  string   // 'Bill Payment' | 'Check' | 'Deposit' | etc.
  txnId:    string   // QB transaction id (from ColData id attribute)
  name:     string   // vendor / customer name
  memo:     string
  split:    string   // contra-account name
  amount:   number   // positive = credit/money-in, negative = debit/money-out
  balance:  number   // running balance after this line
}

// ── Per-month rollup ──────────────────────────────────────────────────────────
export interface QBAlostouraMonthSummary {
  month:     string   // YYYY-MM
  label:     string   // "Jan 2025"
  credits:   number   // total money in  (sum of positive amounts)
  debits:    number   // total money out (sum of absolute negative amounts)
  netChange: number   // credits − debits
  balance:   number   // closing running balance for the month
}

// ── Debug / reconciliation stats returned by /api/quickbooks/classes ─────────
export interface QBDebugInfo {
  fetchedAt:   string
  source:      'live' | 'snapshot'
  dateFilter:  { from: string | null; to: string | null }
  purchases: {
    fetched:        number
    pages:          number
    inRange:        number
    expenseLines:   number
    taggedLines:    number
    untaggedLines:  number
    qbHeaderTotal:  number
    ourLineTotal:   number
  }
  bills: {
    fetched:        number
    pages:          number
    inRange:        number
    expenseLines:   number
    taggedLines:    number
    untaggedLines:  number
    qbHeaderTotal:  number
    ourLineTotal:   number
  }
  vendorCredits?: {
    fetched:        number
    inRange:        number
    taggedLines:    number
    creditTotal:    number
  }
  combined: {
    qbHeaderTotal:  number
    grossLineTotal: number
    creditTotal:    number
    ourTotal:       number
    untaggedTotal:  number
    taxGap:         number
  }
}

// ── Cached snapshot stored in Supabase qb_snapshot ──────────
export interface QBSnapshot {
  realm_id:     string
  company_name: string
  synced_at:    string           // ISO timestamp
  invoices:     QBInvoice[]
  payments:     QBPayment[]
  customers:    QBCustomer[]
  // Optional — added by migration add_qb_classes_expenses.sql
  classes?:     QBClass[]
  purchases?:   QBPurchase[]
  bills?:       QBBill[]
}
