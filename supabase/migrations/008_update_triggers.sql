-- ============================================
-- עדכון Triggers לסטטיסטיקות
-- ============================================

-- עדכון הטריגר לעדכון סטטיסטיקות אחרי INSERT/UPDATE/DELETE של טרנזקציה
CREATE OR REPLACE FUNCTION update_stats_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- אם זה INSERT או UPDATE
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM update_institution_stats(NEW.institution_id);
    PERFORM update_group_stats(NEW.group_id);
    RETURN NEW;
  -- אם זה DELETE
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM update_institution_stats(OLD.institution_id);
    PERFORM update_group_stats(OLD.group_id);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- החלפת הטריגר הישן בחדש
DROP TRIGGER IF EXISTS trigger_update_debt_on_transaction ON transactions;

CREATE TRIGGER trigger_update_stats_on_transaction 
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_stats_on_transaction();

-- עדכון הטריגר לעדכון סטטיסטיקות כשמשנים אחוזי קבוצה
CREATE OR REPLACE FUNCTION recalculate_group_transactions()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_transaction_vouchers(id) FROM transactions WHERE group_id = NEW.id;
  PERFORM update_institution_stats(NEW.institution_id);
  PERFORM update_group_stats(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- עדכון הטריגר לתשלומי חוב - להשתמש בפונקציה החדשה
CREATE OR REPLACE FUNCTION update_debt_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_institution_stats(NEW.institution_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
