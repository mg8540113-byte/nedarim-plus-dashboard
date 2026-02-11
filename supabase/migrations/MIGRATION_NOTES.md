# הערות חשובות למעבר לוגיקת חובות לקוחות

## סיכום השינויים

### מיגרציות Database שבוצעו (013-017):

1. **013_create_clients_table.sql**
   - טבלת לקוחות עם ת"ז, פרטים אישיים וסטטיסטיקות מצטברות

2. **014_create_client_payments_table.sql**
   - טבלת תשלומי לקוחות

3. **015_update_transactions_for_clients.sql**
   - **קריטי**: המרה של GENERATED COLUMNS ל-regular columns
   - כל הנתונים הקיימים נשמרו!
   - הוספת `client_id`, `client_debt`, `client_paid`

4. **016_update_voucher_calculation.sql**
   - פונקציה מעודכנת עם תמיכה בשתי לוגיקות:
     - **לוגיקה חדשה (client_id NOT NULL)**: net_amount → חישוב חוב לקוח
     - **לוגיקה ישנה (client_id IS NULL)**: amount_paid → חישוב net_amount
   - חלוקת תלושים זהה לשניהם

5. **017_client_debt_functions.sql**
   - `update_client_stats()` - חישוב חוב כולל
   - `allocate_client_payment()` - FIFO allocation
   - `upsert_client_from_transaction()` - יצירה/עדכון לקוח
   - Triggers אוטומטיים

## תאימות לאחור

✅ **עסקאות קיימות ממשיכות לעבוד בדיוק כמו קודם!**
- כל עסקה ישנה: `client_id = NULL`
- הפונקציה מזהה זאת ומפעילה את הלוגיקה הישנה
- אין צורך לעדכן שום דבר בקוד Frontend עבור עסקאות קיימות

## נקודות לשים לב

### 1. GENERATED COLUMNS הוסרו
- `total_subsidy` ו-`net_amount` כעת עמודות רגילות
- הערכים נשמרו במהלך ההמרה
- הפונקציה `calculate_transaction_vouchers` מעדכנת אותם

### 2. פונקציה `calculateSubsidy` ב-Frontend
- קיימת ב-`utils/calculations.ts`
- משתמשת בלוגיקה הישנה (amountPaid → netAmount)
- **לא בשימוש פעיל** - אפשר להשאיר אותה
- אם נצטרך, אפשר להוסיף פונקציה חדשה `calculateClientDebt`

### 3. Migration 003 לא שונה
- הקובץ המקורי (`003_tables_only.sql`) נשאר בדיוק כמו שהוא
- הוא מכיל את ההגדרה המקורית עם GENERATED COLUMNS
- זה בסדר! Migration 015 מבצע את ההמרה

## מה הלאה (שלב 2)?

לאחר בדיקה שהמיגרציות רצות בהצלחה:
- עדכון לוגיקת ייבוא Excel (הזמנות + תשלומים)
- שימוש ב-`upsert_client_from_transaction` ליצירת לקוחות
- קריאה ל-`allocate_client_payment` עבור תשלומים

## בדיקות מומלצות

```sql
-- בדיקה 1: ספירת עסקאות חדשות/ישנות
SELECT 
  CASE 
    WHEN client_id IS NULL THEN 'Old Logic'
    ELSE 'New Logic'
  END as logic_type,
  COUNT(*) as count
FROM transactions
GROUP BY logic_type;

-- בדיקה 2: ספירת לקוחות
SELECT COUNT(*) as total_clients FROM clients;

-- בדיקה 3: בדיקת consistency
SELECT 
  id,
  net_amount,
  my_subsidy_amount + institution_subsidy_amount + client_debt as calculated_net
FROM transactions
WHERE client_id IS NOT NULL
  AND ABS(net_amount - (my_subsidy_amount + institution_subsidy_amount + client_debt)) > 0.01;
-- Should return 0 rows
```
