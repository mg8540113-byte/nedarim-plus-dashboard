export interface Institution {
  id: string
  name: string
  total_debt: number
  total_my_subsidy: number
  total_institution_subsidy: number
  total_net_amount: number
  created_at: string
  updated_at: string
}

export interface Group {
  id: string
  institution_id: string
  name: string
  nedarim_groupe_name: string
  my_subsidy_percent: number
  institution_subsidy_percent: number
  voucher_50_percent: number
  voucher_100_percent: number
  voucher_150_percent: number
  voucher_200_percent: number
  total_my_subsidy: number
  total_institution_subsidy: number
  total_net_amount: number
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  nedarim_transaction_id: string
  source: 'nedarim' | 'excel'
  client_name: string
  client_phone: string | null
  client_email: string | null
  client_id_number: string | null
  amount_paid: number
  transaction_time: string
  nedarim_groupe: string
  group_id: string | null
  institution_id: string | null
  my_subsidy_amount: number
  institution_subsidy_amount: number
  total_subsidy: number
  net_amount: number
  vouchers_50: number
  vouchers_100: number
  vouchers_150: number
  vouchers_200: number
  unused_amount: number
  has_unused_warning: boolean
  created_at: string
  updated_at: string
}

export interface UnmappedGroup {
  id: string
  nedarim_groupe_name: string
  first_seen: string
  status: 'pending' | 'mapped'
  mapped_to_group_id: string | null
}

export interface DebtPayment {
  id: string
  institution_id: string
  amount: number
  payment_date: string
  notes: string | null
  created_at: string
}

export interface Voucher {
  id: string
  transaction_id: string
  amount: number
  voucher_code: string
  client_name: string
  client_phone: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SyncLog {
  id: string
  last_transaction_id: string | null
  sync_time: string
  transactions_fetched: number
  status: 'success' | 'error' | 'timeout'
  error_message: string | null
}

export interface SearchResult {
  result_type: 'institution' | 'group' | 'transaction'
  result_id: string
  result_name: string
  result_subtitle: string
}

export interface GroupFormData {
  name: string
  nedarim_groupe_name: string
  my_subsidy_percent: number
  institution_subsidy_percent: number
  voucher_50_percent: number
  voucher_100_percent: number
  voucher_150_percent: number
  voucher_200_percent: number
}

export interface ExcelUploadRow {
  client_name: string
  client_phone: string
  client_id_number: string
  amount_paid: number
  nedarim_groupe: string
}

export interface DashboardStats {
  total_net_amount: number
  total_my_subsidy: number
  total_institution_debt: number
  total_institutions: number
  total_groups: number
  total_transactions: number
}

export interface InstitutionStats {
  institution_id: string
  institution_name: string
  student_count: number
  my_subsidy_total: number
  debt_total: number
}

export interface GroupStats {
  group_id: string
  group_name: string
  institution_name: string
  student_count: number
  my_subsidy_total: number
  debt_total: number
}
