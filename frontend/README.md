# נדרים פלוס - Frontend

דשבורד React מלא לניהול תלושים וסבסודים.

---

## 🚀 התקנה והפעלה

### דרישות מוקדמות
- Node.js 18+ (מותקן ✓)
- npm (מותקן ✓)

### התקנה
```bash
npm install
```

### הפעלה (Development)
```bash
npm run dev
```

האתר יהיה זמין ב: http://localhost:5173 (או 5174 אם 5173 תפוס)

### בנייה ל-Production
```bash
npm run build
```

הקבצים יהיו בתיקיית `dist/`.

---

## 📁 מבנה הקוד

```
frontend/
├── src/
│   ├── App.tsx              ← דף הבית + מוסד + קבוצה + routing
│   ├── main.tsx             ← Entry point
│   ├── index.css            ← Styles + RTL
│   ├── pages/
│   │   ├── DebtManagement.tsx  ← דף ניהול חובות (2 רמות)
│   │   └── SyncManagement.tsx  ← דף ניהול API
│   ├── types/
│   │   └── index.ts         ← TypeScript interfaces
│   └── utils/
│       ├── calculations.ts  ← חישוב תלושים
│       ├── exportExcel.ts   ← ייצוא ל-Excel
│       ├── api-test.ts      ← בדיקת חיבור API
│       └── supabase.ts      ← Supabase client
├── .env                     ← Supabase credentials
├── tailwind.config.js       ← RTL configuration
└── vite.config.ts           ← Vite config
```

---

## 🛠️ טכנולוגיות

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool (מהיר מאוד!)
- **Tailwind CSS v3** - Styling + RTL
- **React Router v7** - ניווט בין דפים
- **React Query** - State management + caching
- **Supabase** - Backend as a Service
- **xlsx** - קריאת קבצי Excel
- **react-hot-toast** - התראות

---

## 📄 דפים

### 1. דף הבית (`/`)
- 3 כרטיסי סטטיסטיקה
- רשימת מוסדות
- CRUD מוסדות
- כפתור העלאת Excel
- כפתור סגירת חובות

### 2. דף מוסד (`/institution/:id`)
- רשימת קבוצות
- CRUD קבוצות
- הגדרת אחוזי סבסוד
- הגדרת חלוקת תלושים

### 3. דף קבוצה (`/group/:id`)
- רשימת עסקאות מפורטת
- חיפוש בזמן אמת
- פירוט סבסוד ותלושים
- אזהרות על יתרות לא מנוצלות

### 4. דף ניהול חובות (`/debt-management`)
- **רמה 1** - סקירת חובות:
  - סה"כ חובות פעילים
  - סה"כ חובות ששולמו
  - כרטיסיות לכל מוסד
- **רמה 2** - פרטי מוסד:
  - היסטוריית תשלומים
  - טופס רישום תשלום חדש
  - ולידציה למניעת תשלום יתר

### 5. דף ניהול API (`/sync-management`)
- הגדרות שרת נדרים פלוס
- שינוי כתובת API
- בדיקת חיבור לשרת
- הגדרות סנכרון אוטומטי
- תדירות סנכרון (5-60 דקות)
- היסטוריית סנכרונים

---

## 🎨 עיצוב

### RTL
- כל האלמנטים מותאמים לעברית
- כיוון: RTL
- גופן: Rubik (Google Fonts)

### צבעים
- **ראשי:** כחול (#3B82F6)
- **הצלחה:** ירוק (#10B981)
- **שגיאה:** אדום (#EF4444)
- **אזהרה:** כתום (#F59E0B)

---

## 🔧 Environment Variables

קובץ `.env` כבר קיים עם פרטי Supabase:

```env
VITE_SUPABASE_URL=https://wnooqfntgkeoeolpzckm.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

אם צריך לשנות, ערוך את `.env` והפעל מחדש את `npm run dev`.

---

## 📤 העלאת Excel

### פורמט הנדרש
קובץ Excel (.xlsx או .xls) עם העמודות הבאות **בדיוק בסדר הזה**:

| שם לקוח | טלפון | תעודת זהות | סכום ששולם | קבוצה | תאריך |
|---------|-------|-----------|-----------|-------|-------|
| ישראל ישראלי | 050-1234567 | 123456789 | 100 | כיתה א | 08/02/2026 |

### תהליך
1. לחץ "העלאת קובץ Excel" בדף הבית
2. בחר קובץ
3. המערכת תבדוק את הפורמט
4. בחר מוסד וקבוצה (או צור חדשים)
5. לחץ "העלה"
6. העסקאות ייוצרו עם חישוב אוטומטי של סבסוד ותלושים

---

## 🐛 דיבאג נפוץ

### מסך לבן
1. בדוק שהשרת רץ (`npm run dev`)
2. בדוק את הפורט הנכון (הודעה בטרמינל)
3. פתח Console ב-Browser (F12)
4. רענן עם Cache Clear (`Ctrl+Shift+R`)

### שגיאת Supabase
1. בדוק את `.env` - ה-URL ו-Key נכונים?
2. בדוק שה-Database רץ ב-Supabase
3. בדוק ש-RLS מושבת (אין authentication)

### שגיאה בהעלאת Excel
1. וודא שכל העמודות הנדרשות קיימות
2. וודא שהתאריך בפורמט DD/MM/YYYY
3. וודא שהסכום מספר (ללא ₪)

---

## 📝 הערות לפיתוח

### ארכיטקטורת הקוד
הקוד מפוצל באופן חכם:
- **App.tsx** - דף הבית, מוסד, קבוצה (הליבה המרכזית)
- **pages/** - דפים נפרדים (Debt, Sync)
- **utils/** - פונקציות עזר מודולריות
- **types/** - TypeScript interfaces

זה מאפשר:
- ✅ קלות תחזוקה
- ✅ קוד מסודר
- ✅ Separation of Concerns
- ✅ קל להרחבה עתידית

### React Query
כל הנתונים מנוהלים עם React Query:
- ✅ Caching אוטומטי
- ✅ Refetching חכם
- ✅ Loading states
- ✅ Error handling

### Tailwind CSS
כל העיצוב ב-utility classes:
- ✅ RTL מובנה
- ✅ Responsive
- ✅ אין קבצי CSS נפרדים (חוץ מ-`index.css`)

---

✅ **המערכת מוכנה לשימוש!**
