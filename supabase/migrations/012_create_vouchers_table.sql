-- ============================================
-- טבלת תלושים (Vouchers)
-- כל תלוש פיזי = שורה אחת
-- ============================================

CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- קישור לעסקה
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  
  -- פרטי התלוש
  amount DECIMAL(10,2) NOT NULL CHECK (amount IN (50, 100, 150, 200)),
  voucher_code TEXT UNIQUE NOT NULL, -- ID של 11 תווים
  
  -- פרטי הלקוח (מועתק מהעסקה לנוחות)
  client_name TEXT NOT NULL,
  client_phone TEXT,
  
  -- סדר (לשמירת הסדר המקורי)
  sort_order INTEGER DEFAULT 0,
  
  -- זמנים
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- אינדקסים לביצועים
-- ============================================

-- חיפוש תלושים לפי עסקה (השימוש המרכזי)
CREATE INDEX IF NOT EXISTS idx_vouchers_transaction_id ON vouchers(transaction_id);

-- חיפוש לפי קוד תלוש (סריקת ברקוד)
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(voucher_code);

-- מיון לפי תאריך יצירה
CREATE INDEX IF NOT EXISTS idx_vouchers_created_at ON vouchers(created_at DESC);

-- ============================================
-- Trigger לעדכון updated_at
-- ============================================

CREATE TRIGGER trigger_update_vouchers_updated_at
  BEFORE UPDATE ON vouchers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- הערות וקומנטס
-- ============================================

COMMENT ON TABLE vouchers IS 'תלושים פיזיים - כל שורה = תלוש אחד להדפסה';
COMMENT ON COLUMN vouchers.voucher_code IS 'מזהה ייחודי של 11 תווים - מופיע על התלוש והברקוד';
COMMENT ON COLUMN vouchers.amount IS 'סכום התלוש: 50/100/150/200 ש״ח בלבד';
COMMENT ON COLUMN vouchers.sort_order IS 'סדר התלוש ברשימה (לתצוגה מסודרת)';
