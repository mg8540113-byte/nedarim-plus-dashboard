-- ============================================
-- פונקציות ניהול חובות לקוחות
-- ============================================

-- פונקציה 1: עדכון סטטיסטיקות לקוח
-- ============================================

CREATE OR REPLACE FUNCTION update_client_stats(client_uuid UUID)
RETURNS void AS $$
DECLARE
  total_debt_calc DECIMAL(10,2);
  total_paid_calc DECIMAL(10,2);
BEGIN
  -- חישוב סה"כ חוב (סכום כל client_debt בעסקאות של לקוח זה)
  SELECT COALESCE(SUM(client_debt), 0)
  INTO total_debt_calc
  FROM transactions
  WHERE client_id = client_uuid;
  
  -- חישוב סה"כ ששולם (סכום כל client_paid בעסקאות של לקוח זה)
  SELECT COALESCE(SUM(client_paid), 0)
  INTO total_paid_calc
  FROM transactions
  WHERE client_id = client_uuid;
  
  -- עדכון הלקוח
  UPDATE clients SET
    total_debt = total_debt_calc,
    total_paid = total_paid_calc,
    updated_at = NOW()
  WHERE id = client_uuid;
END;
$$ LANGUAGE plpgsql;

-- פונקציה 2: התאמת תשלום ללקוח (FIFO)
-- ============================================

CREATE OR REPLACE FUNCTION allocate_client_payment(
  client_uuid UUID,
  payment_amount DECIMAL(10,2)
)
RETURNS void AS $$
DECLARE
  transaction_rec RECORD;
  remaining_payment DECIMAL(10,2);
  amount_to_allocate DECIMAL(10,2);
  transaction_balance DECIMAL(10,2);
BEGIN
  remaining_payment := payment_amount;
  
  -- עבור על כל העסקאות של הלקוח, מהישנה לחדשה (FIFO)
  FOR transaction_rec IN
    SELECT id, client_debt, client_paid
    FROM transactions
    WHERE client_id = client_uuid
      AND (client_debt - client_paid) > 0  -- רק עסקאות עם חוב פתוח
    ORDER BY transaction_time ASC  -- FIFO: הישנה ראשונה
  LOOP
    EXIT WHEN remaining_payment <= 0;
    
    -- כמה נותר לשלם על עסקה זו?
    transaction_balance := transaction_rec.client_debt - transaction_rec.client_paid;
    
    -- כמה להקצות לעסקה זו? (המינימום בין יתרת התשלום ליתרת החוב)
    amount_to_allocate := LEAST(remaining_payment, transaction_balance);
    
    -- עדכון העסקה
    UPDATE transactions SET
      client_paid = client_paid + amount_to_allocate,
      updated_at = NOW()
    WHERE id = transaction_rec.id;
    
    -- הפחתה מיתרת התשלום
    remaining_payment := remaining_payment - amount_to_allocate;
  END LOOP;
  
  -- עדכון סטטיסטיקות הלקוח
  PERFORM update_client_stats(client_uuid);
END;
$$ LANGUAGE plpgsql;

-- פונקציה 3: יצירה/עדכון לקוח מנתוני עסקה
-- ============================================

CREATE OR REPLACE FUNCTION upsert_client_from_transaction(
  id_num TEXT,
  client_name TEXT,
  client_phone TEXT DEFAULT NULL,
  client_email TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  client_uuid UUID;
BEGIN
  -- בדיקה אם הלקוח קיים
  SELECT id INTO client_uuid
  FROM clients
  WHERE id_number = id_num;
  
  IF client_uuid IS NULL THEN
    -- לקוח חדש - יצירה
    INSERT INTO clients (id_number, name, phone, email)
    VALUES (id_num, client_name, client_phone, client_email)
    RETURNING id INTO client_uuid;
  ELSE
    -- לקוח קיים - עדכון פרטים (אם השתנו)
    UPDATE clients SET
      name = client_name,
      phone = COALESCE(client_phone, phone),
      email = COALESCE(client_email, email),
      updated_at = NOW()
    WHERE id = client_uuid;
  END IF;
  
  RETURN client_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Triggers - עדכון אוטומטי
-- ============================================

-- Trigger 1: עדכון סטטיסטיקות לקוח אחרי שינוי בעסקה
CREATE OR REPLACE FUNCTION trigger_update_client_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- אם זה עסקה חדשה (עם לקוח)
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.client_id IS NOT NULL THEN
      PERFORM update_client_stats(NEW.client_id);
    END IF;
    RETURN NEW;
  -- אם זה מחיקה
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.client_id IS NOT NULL THEN
      PERFORM update_client_stats(OLD.client_id);
    END IF;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_transactions_update_client_stats
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_client_stats();

-- Trigger 2: התאמת תשלום אוטומטית אחרי הוספת תשלום
CREATE OR REPLACE FUNCTION trigger_allocate_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- התאמת התשלום לעסקאות (FIFO)
  PERFORM allocate_client_payment(NEW.client_id, NEW.amount);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_client_payments_allocate
  AFTER INSERT ON client_payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_allocate_payment();

-- ============================================
-- הערות
-- ============================================

COMMENT ON FUNCTION update_client_stats IS 'מחשב ומעדכן את total_debt ו-total_paid של לקוח';
COMMENT ON FUNCTION allocate_client_payment IS 'מקצה תשלום לעסקאות בשיטת FIFO (הישנה ראשונה)';
COMMENT ON FUNCTION upsert_client_from_transaction IS 'יוצר או מעדכן לקוח לפי ת"ז';
