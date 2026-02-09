# מערכת ניהול תלושים נדרים פלוס 📊

דשבורד מקצועי לניהול ומעקב אחר תלושי קנייה ממערכת נדרים פלוס, עם סבסוד אוטומטי וניהול חובות מוסדות חינוך.

---

## 📌 סטטוס הפרויקט

### ✅ מה שהושלם

#### 1. Database (Supabase)
- ✅ **Schema מלא** - 6 טבלאות: institutions, groups, transactions, unmapped_groups, debt_payments, sync_log
- ✅ **Functions** - 5 פונקציות עזר:
  - `calculate_transaction_vouchers` - חישוב חלוקת תלושים
  - `update_institution_debt` - עדכון חובות
  - `global_search` - חיפוש גלובלי
  - `remap_unmapped_transactions` - מיפוי קבוצות
  - `generate_transaction_id` - יצירת ID רנדומלי
- ✅ **Triggers** - 3 טריגרים:
  - עדכון אוטומטי של `updated_at`
  - חישוב מחדש כשמשנים הגדרות קבוצה
  - עדכון חוב כשמוסיפים תשלום
- ✅ תמיכה בעסקאות מ-Excel (שדה `source`)

**קבצים:** 
- `supabase/migrations/003_tables_only.sql`
- `supabase/migrations/004_functions_and_triggers.sql`
- `supabase/migrations/005_sample_data.sql`

#### 2. Frontend - אפליקציה מלאה
- ✅ **Setup מלא** - Vite + React 18 + TypeScript
- ✅ **Dependencies** - React Router v7, React Query, Supabase, Tailwind CSS v3, xlsx, react-hot-toast
- ✅ **RTL Configuration** - עברית מלאה, גופן Rubik
- ✅ **Types** - כל ה-TypeScript interfaces
- ✅ **Utils** - חישובים, Supabase client, פורמטים

#### 3. דפים מלאים ✅
כל הדפים נמצאים ב-`App.tsx` (Single-file architecture):

- ✅ **HomePage** - דף הבית מלא:
  - 3 כרטיסי סטטיסטיקה (תלושים, סבסוד, חובות)
  - רשימת מוסדות עם CRUD מלא
  - כפתור העלאת Excel
  - כפתור סגירת חובות
  - Modal הוספה/עריכה מוסדות
  - כפתור + צף
  
- ✅ **InstitutionPage** - דף מוסד מלא:
  - רשימת קבוצות עם סטטיסטיקות
  - CRUD קבוצות מלא (הוספה, עריכה, מחיקה)
  - הגדרת אחוזי סבסוד
  - הגדרת חלוקת תלושים (חייב להסתכם ל-100%)
  - חישוב מחדש אוטומטי של כל העסקאות בשינוי הגדרות
  
- ✅ **GroupPage** - דף קבוצה מלא:
  - 4 כרטיסי סטטיסטיקה
  - רשימת עסקאות מפורטת
  - פירוט מלא לכל עסקה (סבסוד, תלושים, פרטי קשר)
  - אזהרות על יתרות לא מנוצלות
  - חיפוש בזמן אמת
  
- ✅ **DebtManagementPage** - דף סגירת חובות:
  - סטטיסטיקות חובות
  - כרטיסים נפתחים למוסדות עם חוב
  - היסטוריית תשלומים בטבלה
  - טופס הוספת תשלום חדש
  - עדכון חוב אוטומטי

#### 4. העלאת Excel ✅
- ✅ Modal מלא עם הסבר פורמט
- ✅ בדיקת פורמט אוטומטית
- ✅ בחירת מוסד קיים או יצירת חדש
- ✅ בחירת קבוצה קיימת או יצירת חדשה
- ✅ חישוב סבסוד ותלושים אוטומטי
- ✅ יצירת ID אקראי לכל עסקה
- ✅ שדה `source = 'excel'` להבדלה מנדרים

**עמודות נדרשות בקובץ Excel:**
- שם לקוח
- טלפון
- תעודת זהות
- סכום ששולם
- קבוצה
- תאריך (פורמט: DD/MM/YYYY)

---

## 🚧 מה שנשאר לעשות

### 1. ייצוא Excel 📊
3 גיליונות:
1. **סיכום כללי** - נתונים מרכזיים
2. **פירוט מוסדות** - טבלה מסודרת
3. **כל העסקאות** - פירוט מלא

כפתורי ייצוא:
- דף הבית → הכל
- דף מוסד → המוסד
- דף קבוצה → הקבוצה
- דף חובות → היסטוריה

### 2. Modal מיפוי קבוצות לא ממופות 🔗
כאשר מגיעה עסקה מנדרים עם קבוצה שלא קיימת:
- Modal קופץ אוטומטית
- בחירת מוסד
- הגדרת שם קבוצה
- הגדרת אחוזי סבסוד (שלי + מוסד)
- הגדרת חלוקת תלושים (חייב להסתכם ל-100%)
- לחיצה על "שייך" → כל העסקאות מתעדכנות

### 3. Edge Function - סנכרון נדרים 🔄
**קובץ:** `supabase/functions/sync-nedarim/index.ts`

תדירות: כל 10 דקות (Cron Job)

**תהליך:**
1. שליפת last_transaction_id
2. קריאה ל-API נדרים פלוס (Timeout 10 שניות)
3. עיבוד כל עסקה חדשה:
   - בדיקה אם קבוצה קיימת
   - אם לא → הוספה ל-unmapped_groups
   - אם כן → חישוב סבסוד + תלושים + עדכון חוב
4. שמירת לוג

### 4. Realtime Updates ⚡
הגדרת Supabase Realtime subscriptions (אופציונלי):
- עסקאות חדשות
- קבוצות לא ממופות
- שינויים בחובות

---

## 🚀 הוראות הפעלה

### שלב 1: Database Setup

1. היכנס ל-Supabase: https://wnooqfntgkeoeolpzckm.supabase.co
2. לחץ על **SQL Editor** → **New Query**
3. הרץ את הקבצים בסדר:
   - `supabase/migrations/003_tables_only.sql`
   - `supabase/migrations/004_functions_and_triggers.sql`
   - `supabase/migrations/005_sample_data.sql` (אופציונלי - נתונים לדוגמה)
4. אמת שהכל נוצר בהצלחה (ראה `supabase/README.md`)

### שלב 2: Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

האתר יהיה זמין ב: http://localhost:5173 (או 5174 אם 5173 תפוס)

**Environment Variables:**
קובץ `.env` כבר מכיל את פרטי Supabase.

---

## 📁 מבנה הפרויקט (נקי!)

```
nedarim-plus-dashboard/
├── supabase/
│   ├── migrations/
│   │   ├── 003_tables_only.sql          ✅ טבלאות
│   │   ├── 004_functions_and_triggers.sql ✅ פונקציות וטריגרים
│   │   └── 005_sample_data.sql          ✅ נתוני דוגמה
│   └── README.md                        ✅ הדרכה
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                      ✅ כל האפליקציה (4 דפים, כל הלוגיקה)
│   │   ├── main.tsx                     ✅ Entry point
│   │   ├── index.css                    ✅ Styles + RTL
│   │   ├── types/
│   │   │   └── index.ts                 ✅ TypeScript interfaces
│   │   └── utils/
│   │       ├── calculations.ts          ✅ חישוב תלושים
│   │       └── supabase.ts              ✅ Supabase client
│   ├── .env                             ✅ Supabase credentials
│   ├── tailwind.config.js               ✅ RTL configuration
│   ├── postcss.config.js                ✅ PostCSS setup
│   ├── vite.config.ts                   ✅ Vite config
│   └── package.json                     ✅ Dependencies
│
└── README.md                            ✅ המסמך הזה
```

**הערה:** המבנה פשוט במכוון! כל הקוד הראשי נמצא ב-`App.tsx` אחד לקלות תחזוקה ודיבאג.

---

## 🎨 עיצוב

### צבעים
- **ראשי:** #3B82F6 (כחול)
- **הצלחה:** #10B981 (ירוק)
- **שגיאה:** #EF4444 (אדום)
- **אזהרה:** #F59E0B (כתום)
- **רקע:** #F9FAFB (אפור בהיר)

### גופנים
- **Rubik** - גופן עברי נקי ומקצועי (Google Fonts)

### RTL
- כיוון: RTL מלא
- יישור טקסט: ימין
- כפתור + צף: פינה שמאל תחתונה
- כל האלמנטים מותאמים לעברית

---

## ⚠️ נקודות חשובות

### חישוב תלושים
הלוגיקה מורכבת ונמצאת ב:
- **Frontend:** `frontend/src/utils/calculations.ts` (לא בשימוש כרגע)
- **Backend:** Function `calculate_transaction_vouchers` ב-SQL
- **App.tsx:** חישוב פשוט בהעלאת Excel (לפי אחוזים)

**תהליך:**
1. חלוקה לפי אחוזים (מהגדול לקטן: 200→150→100→50)
2. השלמת יתרה (מהגדול לקטן)
3. אם נשארה יתרה → `has_unused_warning = TRUE`

### Recalculation
כל שינוי באחוזים (סבסוד או תלושים) מפעיל טריגר שמחשב מחדש **כל** העסקאות של הקבוצה!

### מחיקה Cascade
מחיקת מוסד → מוחק את כל הקבוצות והעסקאות שלו אוטומטית.

### שדות מחושבים
`total_subsidy` ו-`net_amount` מחושבים אוטומטית במסד הנתונים (**אסור** להכניס להם ערכים ב-INSERT).

---

## 📞 פרטים טכניים

### Supabase
- **URL:** https://wnooqfntgkeoeolpzckm.supabase.co
- **Anon Key:** (בקובץ `.env`)
- **RLS:** מושבת כרגע (אין authentication)

### נדרים פלוס API
- **Endpoint:** https://matara.pro/nedarimplus/Reports/Manage3.aspx
- **Action:** GetHistoryJson
- **Timeout:** 10 שניות
- **מגבלה:** 20 בקשות/שעה (השתמש ב-6/שעה - כל 10 דקות)

---

## 📝 TODO List

- [ ] ייצוא Excel (3 גיליונות)
- [ ] Modal מיפוי קבוצות לא ממופות
- [ ] Edge Function לסנכרון נדרים
- [ ] הגדרת Cron Job ב-Supabase
- [ ] Realtime Subscriptions (אופציונלי)
- [ ] בדיקות מקיפות

---

## 🎯 סיכום

**מה שעובד עכשיו:**
- ✅ Database מלא עם לוגיקה מורכבת
- ✅ 4 דפים מלאים (Home, Institution, Group, Debt Management)
- ✅ CRUD מלא למוסדות וקבוצות
- ✅ העלאת Excel עם חישוב אוטומטי
- ✅ ניהול חובות עם היסטוריית תשלומים
- ✅ חיפוש בעסקאות
- ✅ RTL מלא

**מה שחסר:**
- ⏳ ייצוא Excel
- ⏳ מיפוי קבוצות (למקרה של עסקאות מנדרים עם קבוצה חדשה)
- ⏳ סנכרון אוטומטי מנדרים (Edge Function + Cron)
- ⏳ Realtime Updates (אופציונלי)

**הערכה:** המערכת פונקציונלית מלאה! נשאר בעיקר הסנכרון האוטומטי. 🚀

---

## 🤝 תרומה

הפרויקט נבנה בצורה פשוטה וקלה לתחזוקה. כל הקוד מתועד ועוקב אחר Best Practices של React, TypeScript וSupabase.
