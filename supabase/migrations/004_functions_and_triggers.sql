-- ============================================
-- Functions & Triggers
-- ============================================

-- פונקציה 1: חישוב תלושים
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
BEGIN
  SELECT * INTO trans_record FROM transactions WHERE id = transaction_id;
  IF NOT FOUND THEN RETURN; END IF;
  
  SELECT * INTO grp_record FROM groups WHERE id = trans_record.group_id;
  IF NOT FOUND THEN RETURN; END IF;
  
  UPDATE transactions SET
    my_subsidy_amount = ROUND(amount_paid * grp_record.my_subsidy_percent / 100, 2),
    institution_subsidy_amount = ROUND(amount_paid * grp_record.institution_subsidy_percent / 100, 2)
  WHERE id = transaction_id;
  
  SELECT net_amount INTO original_amount FROM transactions WHERE id = transaction_id;
  
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
  
  -- שלב 2: השלמת יתרה - רק מתלושים זמינים (אחוז > 0)
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

-- פונקציה 2: עדכון חוב מוסד
CREATE OR REPLACE FUNCTION update_institution_debt(inst_id UUID)
RETURNS void AS $$
DECLARE
  total_subsidy DECIMAL(10,2);
  total_payments DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(institution_subsidy_amount), 0) INTO total_subsidy
  FROM transactions WHERE institution_id = inst_id;
  
  SELECT COALESCE(SUM(amount), 0) INTO total_payments
  FROM debt_payments WHERE institution_id = inst_id;
  
  UPDATE institutions
  SET total_debt = total_subsidy - total_payments, updated_at = NOW()
  WHERE id = inst_id;
END;
$$ LANGUAGE plpgsql;

-- פונקציה 3: חיפוש גלובלי
CREATE OR REPLACE FUNCTION global_search(search_term TEXT)
RETURNS TABLE (
  result_type TEXT,
  result_id UUID,
  result_name TEXT,
  result_subtitle TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'institution'::TEXT, id, name, CONCAT('חוב: ₪', total_debt::TEXT)
  FROM institutions WHERE name ILIKE '%' || search_term || '%'
  UNION ALL
  SELECT 'group'::TEXT, g.id, g.name, i.name
  FROM groups g JOIN institutions i ON g.institution_id = i.id
  WHERE g.name ILIKE '%' || search_term || '%'
  UNION ALL
  SELECT 'transaction'::TEXT, t.id, t.client_name,
    CONCAT(g.name, ' • ', TO_CHAR(t.transaction_time, 'DD/MM/YYYY'))
  FROM transactions t LEFT JOIN groups g ON t.group_id = g.id
  WHERE t.client_name ILIKE '%' || search_term || '%' 
    OR t.client_phone ILIKE '%' || search_term || '%'
    OR t.client_id_number ILIKE '%' || search_term || '%'
  ORDER BY result_name LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- פונקציה 4: מיפוי קבוצה
CREATE OR REPLACE FUNCTION remap_unmapped_transactions(new_group_id UUID, nedarim_name TEXT)
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
  inst_id UUID;
BEGIN
  SELECT institution_id INTO inst_id FROM groups WHERE id = new_group_id;
  
  UPDATE transactions
  SET group_id = new_group_id, institution_id = inst_id, updated_at = NOW()
  WHERE nedarim_groupe = nedarim_name;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  PERFORM calculate_transaction_vouchers(id)
  FROM transactions WHERE nedarim_groupe = nedarim_name;
  
  UPDATE unmapped_groups
  SET status = 'mapped', mapped_to_group_id = new_group_id
  WHERE nedarim_groupe_name = nedarim_name;
  
  PERFORM update_institution_debt(inst_id);
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- פונקציה 5: יצירת ID
CREATE OR REPLACE FUNCTION generate_transaction_id()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..11 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION recalculate_group_transactions()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_transaction_vouchers(id) FROM transactions WHERE group_id = NEW.id;
  PERFORM update_institution_debt(NEW.institution_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_debt_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_institution_debt(NEW.institution_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: update_debt_on_transaction הוסרה - מוחלפת ב-update_stats_on_transaction ב-008_update_triggers.sql

-- Triggers
CREATE TRIGGER update_institutions_updated_at BEFORE UPDATE ON institutions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Note: trigger_update_stats_on_transaction מוגדר ב-008_update_triggers.sql
-- (מחליף את trigger_update_debt_on_transaction הישן)

CREATE TRIGGER trigger_recalculate_on_group_update AFTER UPDATE ON groups
FOR EACH ROW WHEN (
  OLD.my_subsidy_percent IS DISTINCT FROM NEW.my_subsidy_percent OR
  OLD.institution_subsidy_percent IS DISTINCT FROM NEW.institution_subsidy_percent OR
  OLD.voucher_50_percent IS DISTINCT FROM NEW.voucher_50_percent OR
  OLD.voucher_100_percent IS DISTINCT FROM NEW.voucher_100_percent OR
  OLD.voucher_150_percent IS DISTINCT FROM NEW.voucher_150_percent OR
  OLD.voucher_200_percent IS DISTINCT FROM NEW.voucher_200_percent
) EXECUTE FUNCTION recalculate_group_transactions();

CREATE TRIGGER trigger_update_debt_on_payment AFTER INSERT ON debt_payments
FOR EACH ROW EXECUTE FUNCTION update_debt_on_payment();
