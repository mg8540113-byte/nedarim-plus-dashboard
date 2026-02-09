-- ============================================
-- נתוני דמו
-- ============================================

INSERT INTO institutions (name) VALUES ('בית ספר לדוגמה');

INSERT INTO groups (
  institution_id,
  name,
  nedarim_groupe_name,
  my_subsidy_percent,
  institution_subsidy_percent,
  voucher_50_percent,
  voucher_100_percent,
  voucher_150_percent,
  voucher_200_percent
) 
SELECT 
  id,
  'כיתה א',
  'כיתה א - בית ספר לדוגמה',
  10,
  10,
  0,
  50,
  0,
  50
FROM institutions
WHERE name = 'בית ספר לדוגמה';
