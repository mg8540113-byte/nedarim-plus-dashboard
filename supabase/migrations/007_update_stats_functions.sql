-- ============================================
-- פונקציות מעודכנות לחישוב סטטיסטיקות
-- ============================================

-- פונקציה 1: עדכון סטטיסטיקות מוסד (מחליפה את update_institution_debt)
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
    total_my_subsidy = total_my_sub,
    total_net_amount = total_net,
    updated_at = NOW()
  WHERE id = inst_id;
END;
$$ LANGUAGE plpgsql;

-- פונקציה 2: עדכון סטטיסטיקות קבוצה (חדש!)
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

-- עדכון הפונקציה הישנה update_institution_debt להפנות לחדשה
-- (לשמירה על תאימות לאחור)
CREATE OR REPLACE FUNCTION update_institution_debt(inst_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM update_institution_stats(inst_id);
END;
$$ LANGUAGE plpgsql;
