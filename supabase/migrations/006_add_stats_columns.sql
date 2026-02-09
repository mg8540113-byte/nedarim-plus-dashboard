-- ============================================
-- הוספת עמודות סטטיסטיקה למוסדות וקבוצות
-- ============================================

-- הוספת עמודות ל-institutions
ALTER TABLE institutions 
  ADD COLUMN IF NOT EXISTS total_my_subsidy DECIMAL(10,2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_net_amount DECIMAL(10,2) DEFAULT 0 NOT NULL;

-- הוספת עמודות ל-groups
ALTER TABLE groups 
  ADD COLUMN IF NOT EXISTS total_my_subsidy DECIMAL(10,2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_net_amount DECIMAL(10,2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_institution_subsidy DECIMAL(10,2) DEFAULT 0 NOT NULL;

-- הוספת אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_transactions_institution_id ON transactions(institution_id);
CREATE INDEX IF NOT EXISTS idx_transactions_group_id ON transactions(group_id);
