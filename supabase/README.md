# הגדרת Database ב-Supabase

## שלב 1: כניסה ל-Supabase

1. כנס לפרויקט שלך ב-Supabase: https://wnooqfntgkeoeolpzckm.supabase.co
2. לחץ על **SQL Editor** בתפריט השמאלי

## שלב 2: הרצת ה-Schema (לפי סדר!)

**חשוב:** הקבצים חייבים להרוץ בסדר הנכון!

### 2.1 יצירת טבלאות
1. לחץ על **New Query**
2. העתק את כל התוכן מקובץ `migrations/003_tables_only.sql`
3. הדבק בעורך ה-SQL
4. לחץ על **Run** (או Ctrl+Enter)
5. וודא שמופיע "Success. No rows returned"

### 2.2 יצירת Functions & Triggers
1. לחץ על **New Query** (שוב)
2. העתק את כל התוכן מקובץ `migrations/004_functions_and_triggers.sql`
3. הדבק והרץ
4. וודא שמופיע "Success. No rows returned"

### 2.3 הכנסת נתוני דוגמה (אופציונלי)
1. לחץ על **New Query**
2. העתק את כל התוכן מקובץ `migrations/005_sample_data.sql`
3. הדבק והרץ
4. אמור להופיע "Success. 1 rows affected" (פעמיים)

## שלב 3: אימות שהכול עובד

### בדיקת טבלאות
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

**אמור להופיע:**
- debt_payments
- groups
- institutions
- sync_log
- transactions
- unmapped_groups

### בדיקת Functions
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

**אמור להופיע:**
- calculate_transaction_vouchers
- generate_transaction_id
- global_search
- recalculate_group_transactions
- remap_unmapped_transactions
- update_debt_on_payment
- update_institution_debt
- update_updated_at_column

### בדיקת נתוני דוגמה (אם הרצת 005)
```sql
SELECT * FROM institutions;
SELECT * FROM groups;
```

אמורים להופיע מוסד וקבוצה לדוגמה.

## שלב 4: מחיקת נתונים לדוגמה (אופציונלי)

אם רוצה למחוק את הנתונים לדוגמה ולהתחיל מאפס:

```sql
DELETE FROM transactions;    -- קודם העסקאות (בגלל foreign keys)
DELETE FROM groups;           -- אז הקבוצות
DELETE FROM institutions;     -- אז המוסדות
```

או פשוט מחק את המוסדות והשאר יימחק אוטומטית (CASCADE):

```sql
DELETE FROM institutions WHERE name = 'בית ספר לדוגמה';
```

## הערות חשובות ⚠️

### שדות מחושבים אוטומטית
השדות הבאים **אסור** להכניס להם ערכים ישירות:
- `total_subsidy` - מחושב כ-`my_subsidy_amount + institution_subsidy_amount`
- `net_amount` - מחושב כ-`amount_paid + my_subsidy_amount + institution_subsidy_amount`

אם תנסה להכניס ערכים לשדות האלה, תקבל שגיאה: `"cannot insert a non-DEFAULT value into column"`

### חישוב מחדש אוטומטי
כל שינוי באחוזי סבסוד או חלוקת תלושים יחשב מחדש את **כל** העסקאות של הקבוצה אוטומטית (דרך טריגר).

### מחיקה Cascade
- מחיקת מוסד → מוחקת את כל הקבוצות והעסקאות שלו
- מחיקת קבוצה → מוחקת את כל העסקאות שלה

### חוב המוסד
מתעדכן אוטומטית בכל שינוי:
- הוספת עסקה → חוב גדל
- מחיקת עסקה → חוב קטן
- שינוי הגדרות קבוצה → חוב מחושב מחדש
- הוספת תשלום → חוב קטן

## בעיות נפוצות 🐛

### שגיאה: "constraint voucher_percentages_sum"
**משמעות:** סכום אחוזי התלושים לא שווה ל-100.

**פתרון:** וודא ש:
```
voucher_50_percent + voucher_100_percent + voucher_150_percent + voucher_200_percent = 100
```

### שגיאה: "duplicate key value"
**משמעות:** `nedarim_transaction_id` או `nedarim_groupe_name` כבר קיים.

**פתרון:** כל ערך חייב להיות ייחודי.

### שגיאה: "cannot insert a non-DEFAULT value into column"
**משמעות:** ניסית להכניס ערך לשדה מחושב (`total_subsidy` או `net_amount`).

**פתרון:** הסר את השדות האלה מה-INSERT. הם יחושבו אוטומטית.

### שגיאה: "relation already exists"
**משמעות:** הטבלה כבר קיימת במסד הנתונים.

**פתרון:** אם אתה רוצה להתחיל מחדש, תחילה מחק הכל:
```sql
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS institutions CASCADE;
DROP TABLE IF EXISTS debt_payments CASCADE;
DROP TABLE IF EXISTS unmapped_groups CASCADE;
DROP TABLE IF EXISTS sync_log CASCADE;
```

אז הרץ שוב את 003 → 004 → 005.

## שאילתות שימושיות 🔧

### סה"כ תלושים נטו
```sql
SELECT SUM(net_amount) as total_vouchers
FROM transactions;
```

### סה"כ חובות
```sql
SELECT SUM(total_debt) as total_debt
FROM institutions;
```

### עסקאות עם יתרה לא מנוצלת
```sql
SELECT client_name, unused_amount
FROM transactions
WHERE has_unused_warning = TRUE;
```

### קבוצות שטרם ממופו
```sql
SELECT * FROM unmapped_groups
WHERE status = 'pending';
```

---

✅ **אחרי שהכל רץ בהצלחה, תוכל להפעיל את ה-Frontend!**
