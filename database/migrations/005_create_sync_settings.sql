-- ============================================
-- טבלאות לניהול סנכרון עם נדרים פלוס
-- ============================================

-- טבלת הגדרות סנכרון (שורה אחת בלבד)
CREATE TABLE IF NOT EXISTS sync_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- הגדרות API
  api_base_url TEXT NOT NULL DEFAULT 'https://matara.pro/nedarimplus/Reports/Manage3.aspx',
  
  -- הגדרות סנכרון
  is_sync_enabled BOOLEAN NOT NULL DEFAULT true,
  sync_interval_minutes INTEGER NOT NULL DEFAULT 10 CHECK (sync_interval_minutes >= 5 AND sync_interval_minutes <= 60),
  
  -- מידע על סנכרון אחרון
  last_sync_time TIMESTAMPTZ,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'error', 'running')),
  last_sync_message TEXT,
  last_sync_count INTEGER DEFAULT 0,
  last_sync_duration_ms INTEGER,
  
  -- זמנים
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- טבלת לוג סנכרונים (היסטוריה)
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  sync_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  message TEXT,
  transactions_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_details TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- אינדקס לביצועים
CREATE INDEX IF NOT EXISTS idx_sync_logs_time ON sync_logs(sync_time DESC);

-- Trigger לעדכון updated_at אוטומטי
CREATE OR REPLACE FUNCTION update_sync_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sync_settings_updated_at
  BEFORE UPDATE ON sync_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_settings_updated_at();

-- הכנסת שורת ברירת מחדל (אם לא קיימת)
-- נשתמש ב-DO כדי לבדוק אם יש כבר שורה
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sync_settings) THEN
    INSERT INTO sync_settings DEFAULT VALUES;
  END IF;
END $$;

COMMENT ON TABLE sync_settings IS 'הגדרות סנכרון עם נדרים פלוס (שורה יחידה)';
COMMENT ON TABLE sync_logs IS 'היסטוריית סנכרונים';
COMMENT ON COLUMN sync_settings.api_base_url IS 'כתובת בסיס של API נדרים פלוס';
COMMENT ON COLUMN sync_settings.is_sync_enabled IS 'האם סנכרון אוטומטי מופעל';
COMMENT ON COLUMN sync_settings.sync_interval_minutes IS 'תדירות סנכרון בדקות';
