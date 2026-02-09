-- ============================================
-- תיקון סטטיסטיקות - הוספת total_institution_subsidy לקבוצות
-- ============================================

-- מחיקת הטריגר הישן קודם (אם קיים)
DROP TRIGGER IF EXISTS trigger_update_debt_on_transaction ON transactions;

-- מחיקת הפונקציה המיותרת
DROP FUNCTION IF EXISTS update_debt_on_transaction();

-- הוספת עמודה חסרה ל-groups
ALTER TABLE groups 
  ADD COLUMN IF NOT EXISTS total_institution_subsidy DECIMAL(10,2) DEFAULT 0 NOT NULL;

-- עדכון הפונקציה update_group_stats לחשב גם סבסוד מוסדי
CREATE OR REPLACE FUNCTION update_group_stats(grp_id UUID)
RETURNS void AS $$
DECLARE
  total_my_sub DECIMAL(10,2);
  total_inst_sub DECIMAL(10,2);
  total_net DECIMAL(10,2);
BEGIN
  -- חישוב סכום הסבסוד שלי
  SELECT COALESCE(SUM(my_subsidy_amount), 0) INTO total_my_sub
  FROM transactions WHERE group_id = grp_id;
  
  -- חישוב סכום סבסוד המוסד
  SELECT COALESCE(SUM(institution_subsidy_amount), 0) INTO total_inst_sub
  FROM transactions WHERE group_id = grp_id;
  
  -- חישוב סכום שווי נטו
  SELECT COALESCE(SUM(net_amount), 0) INTO total_net
  FROM transactions WHERE group_id = grp_id;
  
  -- עדכון הקבוצה
  UPDATE groups
  SET 
    total_my_subsidy = total_my_sub,
    total_institution_subsidy = total_inst_sub,
    total_net_amount = total_net,
    updated_at = NOW()
  WHERE id = grp_id;
END;
$$ LANGUAGE plpgsql;

-- אכלוס הנתונים בעמודה החדשה
DO $$
DECLARE
  grp_record RECORD;
BEGIN
  FOR grp_record IN SELECT id FROM groups LOOP
    PERFORM update_group_stats(grp_record.id);
  END LOOP;
END $$;
