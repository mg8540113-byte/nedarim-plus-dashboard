import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'
import toast from 'react-hot-toast'
import { testServerConnection, isValidUrl, normalizeUrl } from '../utils/api-test'

const DEFAULT_API_URL = 'https://matara.pro/nedarimplus/Reports/Manage3.aspx'

export function SyncManagementPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  // State
  const [showUrlModal, setShowUrlModal] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean, message: string, time: number } | null>(null)
  
  // שליפת הגדרות
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['sync_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_settings')
        .select('*')
        .maybeSingle() // maybeSingle במקום single - לא זורק שגיאה אם אין שורה
      
      // אם אין שורה בכלל, ננסה ליצור אחת
      if (!data) {
        const { data: newData, error: insertError } = await supabase
          .from('sync_settings')
          .insert({})
          .select()
          .single()
        
        if (insertError) {
          console.error('Failed to create default settings:', insertError)
          throw insertError
        }
        return newData
      }
      
      if (error) throw error
      return data
    }
  })
  
  // שליפת לוג (10 אחרונים)
  const { data: logs } = useQuery({
    queryKey: ['sync_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('sync_time', { ascending: false })
        .limit(10)
      
      if (error) throw error
      return data
    }
  })
  
  // Mutation לעדכון הגדרות
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: any) => {
      // אם אין settings, ננסה ליצור שורה חדשה
      if (!settings || !settings.id) {
        const { data: newSettings, error: insertError } = await supabase
          .from('sync_settings')
          .insert({ ...updates })
          .select()
          .single()
        
        if (insertError) throw insertError
        return newSettings
      }
      
      // אם יש settings, נעדכן
      const { data, error } = await supabase
        .from('sync_settings')
        .update(updates)
        .eq('id', settings.id)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync_settings'] })
      toast.success('הגדרות עודכנו בהצלחה')
    },
    onError: (error: any) => {
      toast.error('שגיאה בעדכון הגדרות: ' + error.message)
    }
  })
  
  // פתיחת Modal לשינוי URL
  const handleOpenUrlModal = () => {
    setNewUrl(settings?.api_base_url || DEFAULT_API_URL)
    setShowUrlModal(true)
  }
  
  // שמירת URL חדש
  const handleSaveUrl = () => {
    const normalized = normalizeUrl(newUrl)
    
    if (!normalized) {
      toast.error('נא להזין כתובת URL')
      return
    }
    
    if (!isValidUrl(normalized)) {
      toast.error('כתובת URL לא תקינה')
      return
    }
    
    updateSettingsMutation.mutate({ api_base_url: normalized })
    setShowUrlModal(false)
    setTestResult(null) // איפוס תוצאת בדיקה קודמת
  }
  
  // שחזור לברירת מחדל
  const handleResetUrl = () => {
    setNewUrl(DEFAULT_API_URL)
  }
  
  // בדיקת חיבור
  const handleTestConnection = async () => {
    if (!settings) {
      toast.error('טוען הגדרות...')
      return
    }
    
    if (!settings.api_base_url) {
      toast.error('אין כתובת URL מוגדרת')
      return
    }
    
    setIsTestingConnection(true)
    setTestResult(null)
    
    try {
      const result = await testServerConnection(settings.api_base_url)
      setTestResult({
        success: result.success,
        message: result.message,
        time: result.responseTime
      })
      
      if (result.success) {
        toast.success('חיבור תקין!')
      } else {
        toast.error('בדיקת חיבור נכשלה')
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: 'שגיאה בבדיקת חיבור: ' + error.message,
        time: 0
      })
      toast.error('שגיאה בבדיקה')
    } finally {
      setIsTestingConnection(false)
    }
  }
  
  // עדכון ON/OFF
  const handleToggleSync = () => {
    if (!settings) {
      toast.error('טוען הגדרות...')
      return
    }
    updateSettingsMutation.mutate({ 
      is_sync_enabled: !settings.is_sync_enabled 
    })
  }
  
  // עדכון תדירות
  const handleUpdateInterval = (minutes: number) => {
    if (!settings) {
      toast.error('טוען הגדרות...')
      return
    }
    if (minutes < 5) {
      toast.error('תדירות מינימלית: 5 דקות (מגבלת השרת: 20 בקשות/שעה)')
      return
    }
    if (minutes > 60) {
      toast.error('תדירות מקסימלית: 60 דקות (שעה)')
      return
    }
    updateSettingsMutation.mutate({ sync_interval_minutes: minutes })
  }
  
  // פורמט תאריך
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  // פורמט משך זמן
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }
  
  if (isLoadingSettings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">טוען...</p>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between relative">
            {/* כפתור דף הבית */}
            <button 
              onClick={() => navigate('/')} 
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-blue-600 border-2 border-blue-200 rounded-xl shadow-sm hover:bg-blue-50 hover:border-blue-400 hover:shadow-md hover:scale-105 transition-all duration-200 font-semibold z-10"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
              </svg>
              <span>דף הבית</span>
            </button>
            
            {/* כותרת ממורכזת */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <h1 className="text-3xl font-bold text-gray-900 border-b-2 border-purple-500 pb-2 px-4">
                ניהול API
              </h1>
            </div>
            
            <div className="w-[140px]"></div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        
        {/* כרטיס הגדרות שרת */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            🌐 הגדרות שרת API
          </h2>
          
          <div className="space-y-4">
            {/* כפתור שינוי URL */}
            <div>
              <button
                onClick={handleOpenUrlModal}
                disabled={!settings}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200 font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                שינוי כתובת שרת
              </button>
            </div>
            
            {/* הצגת כתובת נוכחית */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">📍 כתובת נוכחית:</p>
              <p className="text-sm font-mono text-gray-900 break-all">
                {settings?.api_base_url || DEFAULT_API_URL}
              </p>
            </div>
            
            {/* כפתור בדיקת חיבור */}
            <div>
              <button
                onClick={handleTestConnection}
                disabled={isTestingConnection || !settings}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200 font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTestingConnection ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    בודק חיבור...
                  </>
                ) : (
                  <>
                    🧪 בדוק חיבור לשרת
                  </>
                )}
              </button>
              
              {/* תוצאת בדיקה */}
              {testResult && (
                <div className={`mt-3 p-3 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className={`text-sm font-semibold ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                    {testResult.success ? '✅' : '❌'} {testResult.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* כרטיס הגדרות סנכרון */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            🔄 הגדרות סנכרון
          </h2>
          
          <div className="space-y-4">
            {/* כפתור סנכרון אוטומטי */}
            <div className="flex items-center p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-700 font-medium flex-1">סנכרון אוטומטי:</span>
              <button
                onClick={handleToggleSync}
                className={`px-6 py-2.5 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md ${
                  settings?.is_sync_enabled 
                    ? 'bg-green-500 text-white hover:bg-green-600' 
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
              >
                {settings?.is_sync_enabled ? '✓ מופעל' : '✕ מושבת'}
              </button>
            </div>
            
            {/* תדירות */}
            <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-gray-700 font-medium">תדירות סנכרון (דקות):</span>
                <input
                  type="number"
                  value={settings?.sync_interval_minutes || 10}
                  onChange={(e) => handleUpdateInterval(parseInt(e.target.value))}
                  min="5"
                  max="60"
                  step="5"
                  className="w-24 px-3 py-2 border-2 rounded-lg text-center font-semibold"
                />
              </div>
              <p className="text-xs text-gray-500">
                ⚠️ טווח מותר: 5-60 דקות | מגבלת שרת: 20 בקשות/שעה
              </p>
            </div>
            
            {/* כפתור סנכרון ידני */}
            <button
              className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200 font-semibold flex items-center justify-center gap-2"
              onClick={() => toast('סנכרון ידני יתווסף בהמשך', { icon: 'ℹ️' })}
            >
              🔄 סנכרן עכשיו (ידני)
            </button>
          </div>
        </div>
        
        {/* כרטיס סטטוס אחרון */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            📊 סטטוס סנכרון אחרון
          </h2>
          
          {settings?.last_sync_time ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">
                  {settings.last_sync_status === 'success' ? '✅' : '❌'}
                </span>
                <span className="font-semibold text-lg">
                  {settings.last_sync_status === 'success' ? 'הצלחה' : 'שגיאה'}
                </span>
              </div>
              
              <p className="text-gray-600">
                🕐 {formatDate(settings.last_sync_time)}
              </p>
              
              {settings.last_sync_count > 0 && (
                <p className="text-gray-600">
                  📝 {settings.last_sync_count} עסקאות עודכנו
                </p>
              )}
              
              {settings.last_sync_duration_ms && (
                <p className="text-gray-600">
                  ⏱️ משך: {formatDuration(settings.last_sync_duration_ms)}
                </p>
              )}
              
              {settings.last_sync_message && (
                <p className="text-sm text-gray-500 mt-2">
                  {settings.last_sync_message}
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-500">עדיין לא בוצע סנכרון</p>
          )}
        </div>
        
        {/* טבלת לוג */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            📜 היסטוריית סנכרונים (10 אחרונים)
          </h2>
          
          {!logs || logs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">אין היסטוריה עדיין</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">זמן</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">סטטוס</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">עסקאות</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">משך</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">הערה</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(log.sync_time)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {log.status === 'success' ? (
                          <span className="text-green-600 font-semibold">✅ הצלחה</span>
                        ) : (
                          <span className="text-red-600 font-semibold">❌ שגיאה</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-semibold">
                        {log.transactions_count || 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {log.duration_ms ? formatDuration(log.duration_ms) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {log.message || log.error_details || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      
      {/* Modal שינוי URL */}
      {showUrlModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🌐 שינוי כתובת שרת API</h2>
              
              <div className="space-y-4">
                {/* כתובת נוכחית */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">כתובת נוכחית:</p>
                  <p className="text-sm font-mono text-gray-900 break-all">
                    📍 {settings?.api_base_url || DEFAULT_API_URL}
                  </p>
                </div>
                
                {/* כתובת חדשה */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    כתובת חדשה:
                  </label>
                  <input
                    type="text"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
                
                {/* כפתור שחזור */}
                <button
                  onClick={handleResetUrl}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  🔄 שחזר לברירת מחדל
                </button>
                
                {/* הערות */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 font-semibold mb-2">💡 שים לב:</p>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li>הכתובת צריכה להתחיל ב-https:// או http://</li>
                    <li>שינוי ישפיע על הסנכרונים הבאים</li>
                    <li>אפשר תמיד לשחזר לברירת מחדל</li>
                  </ul>
                </div>
              </div>
              
              {/* כפתורים */}
              <div className="flex gap-3 mt-6 justify-center">
                <button
                  onClick={() => setShowUrlModal(false)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold flex items-center justify-center"
                >
                  ביטול
                </button>
                <button
                  onClick={handleSaveUrl}
                  disabled={updateSettingsMutation.isPending}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:shadow-lg disabled:opacity-50 transition-all font-semibold flex items-center justify-center"
                >
                  {updateSettingsMutation.isPending ? 'שומר...' : 'שמור שינויים'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
