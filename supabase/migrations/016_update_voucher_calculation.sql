-- ============================================
-- עדכון פונקציית חישוב תלושים - תמיכה בשתי לוגיקות
-- ============================================

CREATE OR REPLACE FUNCTION calculate_transaction_vouchers(transaction_id UUID)
RETURNS void AS $$
DECLARE
  trans_record RECORD;
  grp_record RECORD;
  original_amount DECIMAL(10,2);
  remaining_amount DECIMAL(10,2);
  v50_count INTEGER;
  v100_count INTEGER;
  v150_count INTEGER;
  v200_count INTEGER;
  calculated_client_debt DECIMAL(10,2);
  calculated_my_subsidy DECIMAL(10,2);
  calculated_inst_subsidy DECIMAL(10,2);
  calculated_total_subsidy DECIMAL(10,2);
  calculated_net_amount DECIMAL(10,2);
BEGIN
  -- שליפת נתוני העסקה והקבוצה
  SELECT * INTO trans_record FROM transactions WHERE id = transaction_id;
  IF NOT FOUND THEN RETURN; END IF;
  
  SELECT * INTO grp_record FROM groups WHERE id = trans_record.group_id;
  IF NOT FOUND THEN RETURN; END IF;
  
  -- ============================================
  -- זיהוי: עסקה חדשה או ישנה?
  -- ============================================
  
  IF trans_record.client_id IS NOT NULL THEN
    -- ============================================
    -- לוגיקה חדשה: חובות לקוחות
    -- ============================================
    -- הקלט: net_amount (שווי התלושים)
    -- חישוב לאחור: כמה הלקוח חייב, כמה סבסוד
    
    original_amount := trans_record.net_amount;
    
    -- חישוב סבסודים מהשווי הנטו
    calculated_my_subsidy := ROUND(original_amount * grp_record.my_subsidy_percent / 100, 2);
    calculated_inst_subsidy := ROUND(original_amount * grp_record.institution_subsidy_percent / 100, 2);
    calculated_total_subsidy := calculated_my_subsidy + calculated_inst_subsidy;
    
    -- חוב הלקוח = שווי נטו - כל הסבסודים
    calculated_client_debt := original_amount - calculated_total_subsidy;
    calculated_net_amount := original_amount;
    
    -- עדכון הערכים המחושבים
    UPDATE transactions SET
      my_subsidy_amount = calculated_my_subsidy,
      institution_subsidy_amount = calculated_inst_subsidy,
      total_subsidy = calculated_total_subsidy,
      client_debt = calculated_client_debt,
      amount_paid = calculated_client_debt  -- לתאימות אחורה
    WHERE id = transaction_id;
    
  ELSE
    -- ============================================
    -- לוגיקה ישנה: amount_paid + סבסודים
    -- ============================================
    -- הקלט: amount_paid (סכום ששולם)
    -- חישוב קדימה: מוסיפים סבסודים
    
    calculated_my_subsidy := ROUND(trans_record.amount_paid * grp_record.my_subsidy_percent / 100, 2);
    calculated_inst_subsidy := ROUND(trans_record.amount_paid * grp_record.institution_subsidy_percent / 100, 2);
    calculated_total_subsidy := calculated_my_subsidy + calculated_inst_subsidy;
    calculated_net_amount := trans_record.amount_paid + calculated_total_subsidy;
    
    original_amount := calculated_net_amount;
    
    -- עדכון הערכים המחושבים
    UPDATE transactions SET
      my_subsidy_amount = calculated_my_subsidy,
      institution_subsidy_amount = calculated_inst_subsidy,
      total_subsidy = calculated_total_subsidy,
      net_amount = calculated_net_amount
    WHERE id = transaction_id;
    
  END IF;
  
  -- ============================================
  -- חלוקת תלושים - זהה לשתי הלוגיקות
  -- ============================================
  
  v50_count := 0;
  v100_count := 0;
  v150_count := 0;
  v200_count := 0;
  
  -- שלב 1: חישוב לפי אחוזים מהסכום המקורי
  IF grp_record.voucher_200_percent > 0 THEN
    v200_count := FLOOR((original_amount * grp_record.voucher_200_percent / 100) / 200);
  END IF;
  
  IF grp_record.voucher_150_percent > 0 THEN
    v150_count := FLOOR((original_amount * grp_record.voucher_150_percent / 100) / 150);
  END IF;
  
  IF grp_record.voucher_100_percent > 0 THEN
    v100_count := FLOOR((original_amount * grp_record.voucher_100_percent / 100) / 100);
  END IF;
  
  IF grp_record.voucher_50_percent > 0 THEN
    v50_count := FLOOR((original_amount * grp_record.voucher_50_percent / 100) / 50);
  END IF;
  
  -- חישוב יתרה
  remaining_amount := original_amount - (v200_count * 200 + v150_count * 150 + v100_count * 100 + v50_count * 50);
  
  -- שלב 2: השלמת יתרה (Greedy) - רק מתלושים זמינים
  IF grp_record.voucher_200_percent > 0 THEN
    WHILE remaining_amount >= 200 LOOP
      v200_count := v200_count + 1;
      remaining_amount := remaining_amount - 200;
    END LOOP;
  END IF;
  
  IF grp_record.voucher_150_percent > 0 THEN
    WHILE remaining_amount >= 150 LOOP
      v150_count := v150_count + 1;
      remaining_amount := remaining_amount - 150;
    END LOOP;
  END IF;
  
  IF grp_record.voucher_100_percent > 0 THEN
    WHILE remaining_amount >= 100 LOOP
      v100_count := v100_count + 1;
      remaining_amount := remaining_amount - 100;
    END LOOP;
  END IF;
  
  IF grp_record.voucher_50_percent > 0 THEN
    WHILE remaining_amount >= 50 LOOP
      v50_count := v50_count + 1;
      remaining_amount := remaining_amount - 50;
    END LOOP;
  END IF;
  
  -- עדכון כמויות התלושים
  UPDATE transactions SET
    vouchers_50 = v50_count,
    vouchers_100 = v100_count,
    vouchers_150 = v150_count,
    vouchers_200 = v200_count,
    unused_amount = remaining_amount,
    has_unused_warning = (remaining_amount > 0)
  WHERE id = transaction_id;
  
END;
$$ LANGUAGE plpgsql;

-- הערה: הפונקציה תומכת בשתי לוגיקות:
-- 1. עסקאות חדשות (client_id NOT NULL): net_amount → חישוב חוב לקוח
-- 2. עסקאות ישנות (client_id IS NULL): amount_paid → חישוב net_amount
-- חלוקת התלושים זהה בשני המקרים
