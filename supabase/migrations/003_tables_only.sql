-- ============================================
-- יצירת טבלאות בלבד
-- ============================================

CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  total_debt DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nedarim_groupe_name TEXT UNIQUE NOT NULL,
  
  my_subsidy_percent DECIMAL(5,2) DEFAULT 0 CHECK (my_subsidy_percent >= 0 AND my_subsidy_percent <= 100),
  institution_subsidy_percent DECIMAL(5,2) DEFAULT 0 CHECK (institution_subsidy_percent >= 0 AND institution_subsidy_percent <= 100),
  
  voucher_50_percent DECIMAL(5,2) DEFAULT 0,
  voucher_100_percent DECIMAL(5,2) DEFAULT 0,
  voucher_150_percent DECIMAL(5,2) DEFAULT 0,
  voucher_200_percent DECIMAL(5,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT voucher_percentages_sum CHECK (
    voucher_50_percent + voucher_100_percent + 
    voucher_150_percent + voucher_200_percent = 100
  )
);

CREATE INDEX idx_groups_institution ON groups(institution_id);
CREATE INDEX idx_groups_nedarim_name ON groups(nedarim_groupe_name);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nedarim_transaction_id TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'nedarim' CHECK (source IN ('nedarim', 'excel')),
  
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  client_id_number TEXT,
  
  amount_paid DECIMAL(10,2) NOT NULL,
  transaction_time TIMESTAMPTZ NOT NULL,
  nedarim_groupe TEXT NOT NULL,
  
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  
  my_subsidy_amount DECIMAL(10,2) DEFAULT 0,
  institution_subsidy_amount DECIMAL(10,2) DEFAULT 0,
  total_subsidy DECIMAL(10,2) GENERATED ALWAYS AS (my_subsidy_amount + institution_subsidy_amount) STORED,
  net_amount DECIMAL(10,2) GENERATED ALWAYS AS (amount_paid + my_subsidy_amount + institution_subsidy_amount) STORED,
  
  vouchers_50 INTEGER DEFAULT 0,
  vouchers_100 INTEGER DEFAULT 0,
  vouchers_150 INTEGER DEFAULT 0,
  vouchers_200 INTEGER DEFAULT 0,
  
  unused_amount DECIMAL(10,2) DEFAULT 0,
  has_unused_warning BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_group ON transactions(group_id);
CREATE INDEX idx_transactions_institution ON transactions(institution_id);
CREATE INDEX idx_transactions_nedarim_id ON transactions(nedarim_transaction_id);
CREATE INDEX idx_transactions_time ON transactions(transaction_time DESC);
CREATE INDEX idx_transactions_source ON transactions(source);

CREATE TABLE unmapped_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nedarim_groupe_name TEXT UNIQUE NOT NULL,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'mapped')),
  mapped_to_group_id UUID REFERENCES groups(id)
);

CREATE TABLE debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_debt_payments_institution ON debt_payments(institution_id);

CREATE TABLE sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_transaction_id TEXT,
  sync_time TIMESTAMPTZ DEFAULT NOW(),
  transactions_fetched INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('success', 'error', 'timeout')),
  error_message TEXT
);
