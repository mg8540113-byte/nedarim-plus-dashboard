-- ============================================
-- אכלוס נתונים קיימים בעמודות החדשות
-- ============================================

-- עדכון כל המוסדות
DO $$
DECLARE
  inst_record RECORD;
BEGIN
  FOR inst_record IN SELECT id FROM institutions LOOP
    PERFORM update_institution_stats(inst_record.id);
  END LOOP;
END $$;

-- עדכון כל הקבוצות
DO $$
DECLARE
  grp_record RECORD;
BEGIN
  FOR grp_record IN SELECT id FROM groups LOOP
    PERFORM update_group_stats(grp_record.id);
  END LOOP;
END $$;
