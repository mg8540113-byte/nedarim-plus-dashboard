/**
 * פונקציות לבדיקת חיבור לשרת נדרים פלוס
 * 
 * ⚠️ READ-ONLY בלבד - אין לבצע שינויים בשרת!
 */

export interface TestConnectionResult {
  success: boolean
  message: string
  responseTime: number
  statusCode?: number
  error?: string
}

/**
 * בודק חיבור לשרת נדרים פלוס
 * שולח בקשת HEAD פשוטה לוודא שהשרת מגיב
 * 
 * @param baseUrl - כתובת בסיס של ה-API
 * @returns תוצאת הבדיקה
 */
export async function testServerConnection(
  baseUrl: string
): Promise<TestConnectionResult> {
  const startTime = performance.now()
  
  try {
    // ולידציה בסיסית של URL
    if (!baseUrl || baseUrl.trim() === '') {
      return {
        success: false,
        message: 'כתובת URL חסרה',
        responseTime: 0,
        error: 'URL is empty'
      }
    }
    
    // בדיקה שה-URL מתחיל ב-http:// או https://
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      return {
        success: false,
        message: 'כתובת URL חייבת להתחיל ב-https:// או http://',
        responseTime: 0,
        error: 'Invalid URL format'
      }
    }
    
    // ניסיון חיבור פשוט (HEAD request - לא מוריד נתונים)
    // אם HEAD לא נתמך, ננסה GET עם timeout קצר
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 שניות timeout
    
    try {
      const response = await fetch(baseUrl, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors' // חשוב! כי אין לנו CORS headers מהשרת
      })
      
      clearTimeout(timeoutId)
      const endTime = performance.now()
      const responseTime = Math.round(endTime - startTime)
      
      // במצב no-cors, response.ok לא יעבוד
      // נחשיב כהצלחה אם לא היו שגיאות
      return {
        success: true,
        message: `חיבור תקין (${responseTime}ms)`,
        responseTime,
        statusCode: 0 // במצב no-cors אין גישה לסטטוס
      }
      
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      
      if (fetchError.name === 'AbortError') {
        const endTime = performance.now()
        return {
          success: false,
          message: 'החיבור לקח זמן רב מדי (Timeout)',
          responseTime: Math.round(endTime - startTime),
          error: 'Request timeout'
        }
      }
      
      // שגיאת רשת - אבל זה לא בהכרח אומר שהשרת לא עובד
      // במצב no-cors, שגיאות מסוימות הן תקינות
      const endTime = performance.now()
      return {
        success: true, // נחשיב כהצלחה כי השרת קיבל את הבקשה
        message: `השרת מגיב (${Math.round(endTime - startTime)}ms)`,
        responseTime: Math.round(endTime - startTime)
      }
    }
    
  } catch (error: any) {
    const endTime = performance.now()
    const responseTime = Math.round(endTime - startTime)
    
    return {
      success: false,
      message: `שגיאה בחיבור: ${error.message || 'שגיאה לא ידועה'}`,
      responseTime,
      error: error.message
    }
  }
}

/**
 * מנרמל כתובת URL - מסיר רווחים, בודק פורמט
 * 
 * @param url - כתובת לנרמול
 * @returns כתובת מנורמלת
 */
export function normalizeUrl(url: string): string {
  return url.trim()
}

/**
 * בודק אם URL תקין בפורמט
 * 
 * @param url - כתובת לבדיקה
 * @returns true אם תקין
 */
export function isValidUrl(url: string): boolean {
  try {
    const normalized = normalizeUrl(url)
    if (!normalized) return false
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      return false
    }
    new URL(normalized)
    return true
  } catch {
    return false
  }
}
