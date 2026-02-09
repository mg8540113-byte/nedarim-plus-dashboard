-- עדכון constraint - טווח: 5-60 דקות
-- (מגבלת שרת נדרים פלוס: מקסימום 20 בקשות לשעה)
-- 
-- חישוב בקשות לשעה:
-- כל 3 דקות = 20 בקשות/שעה (בדיוק המגבלה - מסוכן!)
-- כל 5 דקות = 12 בקשות/שעה (בטוח ✓)
-- כל 10 דקות = 6 בקשות/שעה (בטוח מאוד ✓)
-- כל 60 דקות = 1 בקשה/שעה (הכי בטוח ✓)

-- הסרת constraint הישן
ALTER TABLE sync_settings 
DROP CONSTRAINT IF EXISTS sync_settings_sync_interval_minutes_check;

-- הוספת constraint חדש: מינימום 5, מקסימום 60
ALTER TABLE sync_settings 
ADD CONSTRAINT sync_settings_sync_interval_minutes_check 
CHECK (sync_interval_minutes >= 5 AND sync_interval_minutes <= 60);

-- עדכון שורות קיימות שמחוץ לטווח (אם יש)
UPDATE sync_settings 
SET sync_interval_minutes = 10 
WHERE sync_interval_minutes < 5 OR sync_interval_minutes > 60;

-- הוספת הערה
COMMENT ON CONSTRAINT sync_settings_sync_interval_minutes_check ON sync_settings 
IS 'טווח: 5-60 דקות בגלל מגבלת שרת (20 בקשות/שעה)';
