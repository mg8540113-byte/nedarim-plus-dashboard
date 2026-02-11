-- ============================================
-- עדכון טבלת Transactions - תמיכה בלוגיקת לקוח
-- ============================================

-- שלב 1: הסרת GENERATED COLUMNS והוספת עמודות רגילות
-- --------------------------------------------------------
-- GENERATED COLUMNS לא ניתנות לעדכון - צריך להמיר אותן לעמודות רגילות
-- אבל לשמור את הנתונים הקיימים!

-- שמירה זמנית של הערכים
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS temp_total_subsidy DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS temp_net_amount DECIMAL(10,2);

UPDATE transactions 
SET 
  temp_total_subsidy = total_subsidy,
  temp_net_amount = net_amount;

-- הסרת GENERATED COLUMNS
ALTER TABLE transactions 
  DROP COLUMN IF EXISTS total_subsidy CASCADE,
  DROP COLUMN IF EXISTS net_amount CASCADE;

-- יצירת עמודות רגילות עם הערכים שנשמרו
ALTER TABLE transactions 
  ADD COLUMN total_subsidy DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN net_amount DECIMAL(10,2) DEFAULT 0;

UPDATE transactions 
SET 
  total_subsidy = COALESCE(temp_total_subsidy, my_subsidy_amount + institution_subsidy_amount),
  net_amount = COALESCE(temp_net_amount, amount_paid + my_subsidy_amount + institution_subsidy_amount);

-- ניקוי עמודות זמניות
ALTER TABLE transactions 
  DROP COLUMN IF EXISTS temp_total_subsidy,
  DROP COLUMN IF EXISTS temp_net_amount;

-- שלב 2: הוספת עמודות חדשות ללוגיקת לקוח
-- --------------------------------------------------------

-- קישור ללקוח (NULL = עסקה ישנה, לא ריק = עסקה חדשה)
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- חוב הלקוח על עסקה זו
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS client_debt DECIMAL(10,2) DEFAULT 0;

-- כמה הלקוח שילם על עסקה זו (עדכון דרך FIFO)
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS client_paid DECIMAL(10,2) DEFAULT 0;

-- שלב 3: אינדקסים חדשים
-- --------------------------------------------------------

-- חיפוש לפי לקוח
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id);

-- חיפוש עסקאות עם חוב פתוח
CREATE INDEX IF NOT EXISTS idx_transactions_unpaid ON transactions(client_id, transaction_time) 
  WHERE (client_debt - client_paid) > 0;

-- שלב 4: עדכון amount_paid בעסקאות חדשות
-- --------------------------------------------------------
-- בעסקאות חדשות, amount_paid ישמש בעיקר לתאימות אחורה
-- והוא יהיה שווה ל-client_debt

COMMENT ON COLUMN transactions.client_id IS 'קישור ללקוח (NULL = עסקה ישנה, לא NULL = עסקה חדשה)';
COMMENT ON COLUMN transactions.client_debt IS 'כמה הלקוח חייב על עסקה זו (רלוונטי רק אם client_id לא NULL)';
COMMENT ON COLUMN transactions.client_paid IS 'כמה הלקוח שילם על עסקה זו (מתעדכן דרך FIFO)';
COMMENT ON COLUMN transactions.total_subsidy IS 'סה"כ סבסוד (שלי + מוסד) - כעת עמודה רגילה';
COMMENT ON COLUMN transactions.net_amount IS 'שווי נטו של התלושים - כעת עמודה רגילה';
