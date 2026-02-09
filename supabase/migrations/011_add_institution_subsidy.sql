-- ============================================
-- הוספת total_institution_subsidy לטבלת institutions
-- ============================================

-- הוספת עמודה חסרה ל-institutions
ALTER TABLE institutions 
  ADD COLUMN IF NOT EXISTS total_institution_subsidy DECIMAL(10,2) DEFAULT 0 NOT NULL;

-- עדכון הפונקציה update_institution_stats לחשב גם סבסוד מוסדי
CREATE OR REPLACE FUNCTION update_institution_stats(inst_id UUID)
RETURNS void AS $$
DECLARE
  total_inst_subsidy DECIMAL(10,2);
  total_my_sub DECIMAL(10,2);
  total_net DECIMAL(10,2);
  total_payments DECIMAL(10,2);
BEGIN
  -- חישוב סכום סבסוד המוסד
  SELECT COALESCE(SUM(institution_subsidy_amount), 0) INTO total_inst_subsidy
  FROM transactions WHERE institution_id = inst_id;
  
  -- חישוב סכום הסבסוד שלי
  SELECT COALESCE(SUM(my_subsidy_amount), 0) INTO total_my_sub
  FROM transactions WHERE institution_id = inst_id;
  
  -- חישוב סכום שווי נטו
  SELECT COALESCE(SUM(net_amount), 0) INTO total_net
  FROM transactions WHERE institution_id = inst_id;
  
  -- חישוב סכום תשלומים
  SELECT COALESCE(SUM(amount), 0) INTO total_payments
  FROM debt_payments WHERE institution_id = inst_id;
  
  -- עדכון המוסד
  UPDATE institutions
  SET 
    total_debt = total_inst_subsidy - total_payments,
    total_institution_subsidy = total_inst_subsidy,
    total_my_subsidy = total_my_sub,
    total_net_amount = total_net,
    updated_at = NOW()
  WHERE id = inst_id;
END;
$$ LANGUAGE plpgsql;

-- אכלוס הנתונים בעמודה החדשה
DO $$
DECLARE
  inst_record RECORD;
BEGIN
  FOR inst_record IN SELECT id FROM institutions LOOP
    PERFORM update_institution_stats(inst_record.id);
  END LOOP;
END $$;
