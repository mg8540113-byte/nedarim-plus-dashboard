-- ============================================
-- טבלת תשלומי לקוחות (Client Payments)
-- ============================================

CREATE TABLE IF NOT EXISTS client_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- קישור ללקוח
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- פרטי התשלום
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  
  -- הערות אופציונליות
  notes TEXT,
  
  -- זמן יצירה (לא ניתן לעדכון)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- אינדקסים לביצועים
-- ============================================

-- חיפוש תשלומים לפי לקוח (השימוש המרכזי)
CREATE INDEX IF NOT EXISTS idx_client_payments_client_id ON client_payments(client_id);

-- מיון לפי תאריך תשלום
CREATE INDEX IF NOT EXISTS idx_client_payments_date ON client_payments(payment_date DESC);

-- חיפוש משולב (לקוח + תאריך)
CREATE INDEX IF NOT EXISTS idx_client_payments_client_date ON client_payments(client_id, payment_date DESC);

-- ============================================
-- הערות וקומנטס
-- ============================================

COMMENT ON TABLE client_payments IS 'תשלומי לקוחות - רישום כל תשלום שמתקבל';
COMMENT ON COLUMN client_payments.amount IS 'סכום התשלום בש"ח';
COMMENT ON COLUMN client_payments.payment_date IS 'תאריך ביצוע התשלום';
COMMENT ON COLUMN client_payments.notes IS 'הערות חופשיות (מקור התשלום, אמצעי תשלום וכו)';
