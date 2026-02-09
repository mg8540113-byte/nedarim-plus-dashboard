# 🚀 הוראות פריסה - נדרים פלוס Dashboard

## דרישות מוקדמות
- חשבון GitHub
- חשבון Vercel (חינמי)
- פרויקט Supabase פעיל

---

## 📦 שלב 1: העלאה ל-GitHub

### 1.1 יצירת Repository ב-GitHub
1. היכנס ל-[GitHub](https://github.com)
2. לחץ על **"New Repository"**
3. שם: `nedarim-plus-dashboard`
4. סוג: **Private** (מומלץ)
5. **אל תסמן** "Initialize with README"
6. לחץ **"Create Repository"**

### 1.2 העלאת הקוד (הפעל בטרמינל):

```bash
cd "c:\Users\mg854\OneDrive\מסמכים\good!!\nedarim-plus-dashboard"

# אתחול Git
git init

# הוספת כל הקבצים
git add .

# Commit ראשון
git commit -m "Initial commit - Nedarim Plus Dashboard"

# חיבור ל-GitHub (החלף YOUR_USERNAME בשם המשתמש שלך)
git remote add origin https://github.com/YOUR_USERNAME/nedarim-plus-dashboard.git

# העלאה
git branch -M main
git push -u origin main
```

---

## 🌐 שלב 2: פריסה ב-Vercel

### 2.1 חיבור Vercel ל-GitHub
1. היכנס ל-[Vercel](https://vercel.com)
2. התחבר עם חשבון GitHub
3. לחץ **"Add New Project"**
4. בחר ב-Repository: `nedarim-plus-dashboard`
5. לחץ **"Import"**

### 2.2 הגדרות פרויקט:

**Framework Preset:** Vite

**Root Directory:** `frontend`

**Build Command:** `npm run build`

**Output Directory:** `dist`

**Install Command:** `npm install`

### 2.3 משתני סביבה (Environment Variables):

הוסף את המשתנים הבאים:

```
VITE_SUPABASE_URL=<YOUR_SUPABASE_URL>
VITE_SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
```

**איפה למצוא?** בפרויקט Supabase שלך:
- Settings → API → Project URL
- Settings → API → Project API keys → anon/public

### 2.4 פריסה
לחץ **"Deploy"** והמתן ~2 דקות

---

## ✅ סיימת!

הפרויקט שלך יהיה זמין בכתובת:
```
https://your-project-name.vercel.app
```

כל שינוי שתעשה ב-GitHub יתעדכן אוטומטית!

---

## 🔐 אבטחה

⚠️ **חשוב:** אל תשתף את קובץ ה-`.env` עם אף אחד!
משתני הסביבה מוגדרים ישירות ב-Vercel.

---

## 📞 תמיכה

אם יש בעיות בפריסה, בדוק:
1. שכל משתני הסביבה מוגדרים נכון ב-Vercel
2. שה-Build Log ב-Vercel לא מציג שגיאות
3. שהפרויקט Supabase פעיל ונגיש
