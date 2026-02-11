-- ============================================
-- טבלת לקוחות (Clients)
-- ============================================

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- מזהה ייחודי (ת"ז)
  id_number TEXT UNIQUE NOT NULL,
  
  -- פרטים אישיים
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  
  -- סטטיסטיקות מצטברות (מחושבות)
  total_debt DECIMAL(10,2) DEFAULT 0 NOT NULL,
  total_paid DECIMAL(10,2) DEFAULT 0 NOT NULL,
  
  -- זמנים
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- אינדקסים לביצועים
-- ============================================

-- חיפוש מהיר לפי ת"ז (השימוש המרכזי)
CREATE INDEX IF NOT EXISTS idx_clients_id_number ON clients(id_number);

-- חיפוש לפי שם (למקרה של חיפוש חלקי)
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

-- ============================================
-- Trigger לעדכון updated_at
-- ============================================

CREATE TRIGGER trigger_update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- הערות וקומנטס
-- ============================================

COMMENT ON TABLE clients IS 'לקוחות - מעקב אחרי חובות ותשלומים';
COMMENT ON COLUMN clients.id_number IS 'תעודת זהות - מזהה ייחודי';
COMMENT ON COLUMN clients.total_debt IS 'סה"כ חוב נוכחי (מחושב מסכום כל ההזמנות פתוחות)';
COMMENT ON COLUMN clients.total_paid IS 'סה"כ כל התשלומים שבוצעו';
