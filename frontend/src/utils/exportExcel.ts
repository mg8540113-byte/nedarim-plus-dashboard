import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import { formatCurrency } from './calculations'
import toast from 'react-hot-toast'

// ============================================
// פונקציית עזר: חישוב רוחב עמודה אוטומטי
// ============================================
function calculateColumnWidth(data: any[][]): any[] {
  const columnWidths: number[] = []
  
  data.forEach(row => {
    row.forEach((cell, colIndex) => {
      const cellValue = String(cell || '')
      const cellLength = cellValue.length
      
      if (!columnWidths[colIndex] || columnWidths[colIndex] < cellLength) {
        columnWidths[colIndex] = cellLength
      }
    })
  })
  
  // המרה לפורמט של xlsx: { wch: number }
  // הוספת 2 תווים padding לכל עמודה
  return columnWidths.map(width => ({ wch: Math.min(width + 2, 50) }))
}

// ============================================
// פונקציית עזר: המרת מטבע לנתון מספרי טהור
// ============================================
function currencyToNumber(value: number): number {
  return Math.round(value * 100) / 100
}

interface ExportOptions {
  exportType: 'all' | 'institutions' | 'groups' | 'dates'
  institutions: any[]
  groups: any[]
  transactions: any[]
  selectedExportInstitutions?: string[]
  selectedExportGroups?: string[]
  exportDateFrom?: string
  exportDateTo?: string
  setExportProgress: (progress: number) => void
  setIsExporting: (isExporting: boolean) => void
}

export const exportToExcel = async (options: ExportOptions) => {
  const {
    exportType,
    institutions,
    groups,
    transactions,
    selectedExportInstitutions = [],
    selectedExportGroups = [],
    exportDateFrom = '',
    exportDateTo = '',
    setExportProgress,
    setIsExporting
  } = options

  try {
    setIsExporting(true)
    setExportProgress(10)
    
    // שלב 1: שליפת נתונים
    let filteredInstitutions = institutions || []
    let filteredGroups = groups || []
    let filteredTransactions = transactions || []
    
    // סינון לפי סוג הייצוא
    if (exportType === 'institutions' && selectedExportInstitutions.length > 0) {
      filteredInstitutions = filteredInstitutions.filter(i => selectedExportInstitutions.includes(i.id))
      filteredGroups = filteredGroups.filter(g => selectedExportInstitutions.includes(g.institution_id))
      filteredTransactions = filteredTransactions.filter(t => selectedExportInstitutions.includes(t.institution_id || ''))
    } else if (exportType === 'groups' && selectedExportGroups.length > 0) {
      filteredGroups = filteredGroups.filter(g => selectedExportGroups.includes(g.id))
      filteredTransactions = filteredTransactions.filter(t => selectedExportGroups.includes(t.group_id || ''))
      const institutionIds = [...new Set(filteredGroups.map(g => g.institution_id))]
      filteredInstitutions = filteredInstitutions.filter(i => institutionIds.includes(i.id))
    } else if (exportType === 'dates') {
      if (exportDateFrom) {
        filteredTransactions = filteredTransactions.filter(t => new Date(t.transaction_time) >= new Date(exportDateFrom))
      }
      if (exportDateTo) {
        filteredTransactions = filteredTransactions.filter(t => new Date(t.transaction_time) <= new Date(exportDateTo + 'T23:59:59'))
      }
      const groupIds = [...new Set(filteredTransactions.map(t => t.group_id).filter(Boolean))]
      filteredGroups = filteredGroups.filter(g => groupIds.includes(g.id))
      const institutionIds = [...new Set(filteredGroups.map(g => g.institution_id))]
      filteredInstitutions = filteredInstitutions.filter(i => institutionIds.includes(i.id))
    }
    
    setExportProgress(30)
    
    // שליפת תשלומי חוב
    const { data: payments } = await supabase
      .from('debt_payments')
      .select('*')
      .order('payment_date', { ascending: false })
    
    setExportProgress(50)
    
    // יצירת Workbook חדש
    const workbook = XLSX.utils.book_new()
    
    // ============================================
    // גיליון 1: סיכום כללי
    // ============================================
    const summaryData = [
      ['מערכת ניהול שוברים - דוח מרוכז'],
      ['תאריך ייצוא:', new Date().toLocaleDateString('he-IL')],
      [''],
      ['📊 סטטיסטיקות כלליות:'],
      ['מספר מוסדות:', filteredInstitutions.length],
      ['מספר קבוצות:', filteredGroups.length],
      ['מספר עסקאות:', filteredTransactions.length],
      ['סה"כ תלושים נטו (₪):', currencyToNumber(filteredTransactions.reduce((sum, t) => sum + (t.net_amount || 0), 0))],
      ['סה"כ הסבסוד שלי (₪):', currencyToNumber(filteredTransactions.reduce((sum, t) => sum + (t.my_subsidy_amount || 0), 0))],
      ['סה"כ סבסוד מוסדות (₪):', currencyToNumber(filteredTransactions.reduce((sum, t) => sum + (t.institution_subsidy_amount || 0), 0))],
      ['סה"כ חובות פתוחים (₪):', currencyToNumber(filteredInstitutions.reduce((sum, i) => sum + (i.total_debt || 0), 0))],
      [''],
      ['📋 פירוט מוסדות:'],
      ['שם המוסד', 'מספר קבוצות', 'תלושים נטו (₪)', 'הסבסוד שלי (₪)', 'סבסוד מוסד (₪)', 'חוב פתוח (₪)'],
      ...filteredInstitutions.map(inst => [
        inst.name,
        filteredGroups.filter(g => g.institution_id === inst.id).length,
        currencyToNumber(inst.total_net_amount || 0),
        currencyToNumber(inst.total_my_subsidy || 0),
        currencyToNumber(inst.total_institution_subsidy || 0),
        currencyToNumber(inst.total_debt || 0)
      ])
    ]
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    
    // רוחב עמודות אוטומטי
    summarySheet['!cols'] = calculateColumnWidth(summaryData)
    
    // Auto-filter על שורת הכותרות של פירוט מוסדות (שורה 14)
    const summaryLastRow = summaryData.length - 1
    summarySheet['!autofilter'] = { ref: `A13:F${summaryLastRow + 1}` }
    
    // Freeze panes - קפאת שורת הכותרת
    summarySheet['!freeze'] = { xSplit: 0, ySplit: 14, topLeftCell: 'A15', activePane: 'bottomRight' }
    
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'סיכום כללי')
    
    setExportProgress(60)
    
    // ============================================
    // גיליון 2: מוסדות וקבוצות
    // ============================================
    const groupsData = [
      ['שם מוסד', 'שם קבוצה', 'מספר עסקאות', 'תלושים נטו (₪)', 'הסבסוד שלי (₪)', 'סבסוד מוסד (₪)', 'תאריך עדכון'],
      ...filteredGroups.map(group => {
        const inst = filteredInstitutions.find(i => i.id === group.institution_id)
        return [
          inst?.name || '',
          group.name,
          filteredTransactions.filter(t => t.group_id === group.id).length,
          currencyToNumber(group.total_net_amount || 0),
          currencyToNumber(group.total_my_subsidy || 0),
          currencyToNumber(group.total_institution_subsidy || 0),
          new Date(group.updated_at).toLocaleDateString('he-IL')
        ]
      })
    ]
    
    const groupsSheet = XLSX.utils.aoa_to_sheet(groupsData)
    
    // רוחב עמודות אוטומטי
    groupsSheet['!cols'] = calculateColumnWidth(groupsData)
    
    // Auto-filter על שורת הכותרות
    const groupsLastRow = groupsData.length
    groupsSheet['!autofilter'] = { ref: `A1:G${groupsLastRow}` }
    
    // Freeze panes - קפאת שורת הכותרת
    groupsSheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomRight' }
    
    XLSX.utils.book_append_sheet(workbook, groupsSheet, 'מוסדות וקבוצות')
    
    setExportProgress(70)
    
    // ============================================
    // גיליון 3: כל העסקאות
    // ============================================
    const transactionsData = [
      ['תאריך', 'מוסד', 'קבוצה', 'שם לקוח', 'טלפון', 'ת.ז', 'סכום ששולם (₪)', 'הסבסוד שלי (₪)', 'סבסוד מוסד (₪)', 'סה"כ סבסוד (₪)', 'שווי נטו (₪)', 'תלושים', 'לא מנוצל (₪)', 'מקור'],
      ...filteredTransactions.map(t => {
        const group = filteredGroups.find(g => g.id === t.group_id)
        const inst = filteredInstitutions.find(i => i.id === t.institution_id)
        const vouchersText = [
          t.vouchers_50 > 0 ? `${t.vouchers_50}×50` : '',
          t.vouchers_100 > 0 ? `${t.vouchers_100}×100` : '',
          t.vouchers_150 > 0 ? `${t.vouchers_150}×150` : '',
          t.vouchers_200 > 0 ? `${t.vouchers_200}×200` : ''
        ].filter(Boolean).join(', ')
        
        return [
          new Date(t.transaction_time).toLocaleDateString('he-IL'),
          inst?.name || '',
          group?.name || '',
          t.client_name,
          t.client_phone || '',
          t.client_id_number || '',
          currencyToNumber(t.amount_paid),
          currencyToNumber(t.my_subsidy_amount),
          currencyToNumber(t.institution_subsidy_amount),
          currencyToNumber(t.total_subsidy),
          currencyToNumber(t.net_amount),
          vouchersText,
          currencyToNumber(t.unused_amount || 0),
          t.source === 'excel' ? 'Excel' : 'נדרים'
        ]
      })
    ]
    
    const transactionsSheet = XLSX.utils.aoa_to_sheet(transactionsData)
    
    // רוחב עמודות אוטומטי
    transactionsSheet['!cols'] = calculateColumnWidth(transactionsData)
    
    // Auto-filter על שורת הכותרות
    const transactionsLastRow = transactionsData.length
    transactionsSheet['!autofilter'] = { ref: `A1:N${transactionsLastRow}` }
    
    // Freeze panes - קפאת שורת הכותרת + 3 עמודות ראשונות (תאריך, מוסד, קבוצה)
    transactionsSheet['!freeze'] = { xSplit: 3, ySplit: 1, topLeftCell: 'D2', activePane: 'bottomRight' }
    
    XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'כל העסקאות')
    
    setExportProgress(80)
    
    // ============================================
    // גיליון 4: חובות מוסדות
    // ============================================
    const totalActiveDebt = filteredInstitutions.reduce((sum, i) => sum + (i.total_debt || 0), 0)
    const totalPaymentsThisYear = payments?.filter(p => new Date(p.payment_date).getFullYear() === new Date().getFullYear()).reduce((sum, p) => sum + (p.amount || 0), 0) || 0
    
    const debtsData = [
      ['📊 סיכום חובות:'],
      ['סה"כ חובות פתוחים (₪):', currencyToNumber(totalActiveDebt)],
      ['מספר מוסדות עם חוב:', filteredInstitutions.filter(i => (i.total_debt || 0) > 0).length],
      ['סה"כ תשלומים השנה (₪):', currencyToNumber(totalPaymentsThisYear)],
      [''],
      ['📋 פירוט חובות לפי מוסד:'],
      ['שם מוסד', 'חוב נוכחי (₪)', 'סה"כ סבסוד מוסד (₪)', 'סה"כ תשלומים (₪)', 'מספר תשלומים', 'תאריך עדכון'],
      ...filteredInstitutions
        .filter(i => (i.total_debt || 0) > 0)
        .map(inst => {
          const instPayments = payments?.filter(p => p.institution_id === inst.id) || []
          return [
            inst.name,
            currencyToNumber(inst.total_debt || 0),
            currencyToNumber(inst.total_institution_subsidy || 0),
            currencyToNumber(instPayments.reduce((sum, p) => sum + (p.amount || 0), 0)),
            instPayments.length,
            new Date(inst.updated_at).toLocaleDateString('he-IL')
          ]
        }),
      [''],
      ['💰 היסטוריית תשלומים:'],
      ['תאריך', 'שם מוסד', 'סכום תשלום (₪)', 'הערות'],
      ...(payments?.filter(p => {
        const inst = filteredInstitutions.find(i => i.id === p.institution_id)
        return inst !== undefined
      }).map(payment => {
        const inst = filteredInstitutions.find(i => i.id === payment.institution_id)
        return [
          new Date(payment.payment_date).toLocaleDateString('he-IL'),
          inst?.name || '',
          currencyToNumber(payment.amount),
          payment.notes || '-'
        ]
      }) || [])
    ]
    
    const debtsSheet = XLSX.utils.aoa_to_sheet(debtsData)
    
    // רוחב עמודות אוטומטי
    debtsSheet['!cols'] = calculateColumnWidth(debtsData)
    
    // Auto-filter על שורת הכותרות של פירוט חובות (שורה 7)
    const debtInstitutionsCount = filteredInstitutions.filter(i => (i.total_debt || 0) > 0).length
    if (debtInstitutionsCount > 0) {
      debtsSheet['!autofilter'] = { ref: `A6:F${6 + debtInstitutionsCount}` }
    }
    
    // Auto-filter על היסטוריית תשלומים
    const paymentsStartRow = 6 + debtInstitutionsCount + 3
    const paymentsCount = payments?.filter(p => filteredInstitutions.find(i => i.id === p.institution_id)).length || 0
    if (paymentsCount > 0) {
      debtsSheet['!autofilter'] = { ref: `A${paymentsStartRow}:D${paymentsStartRow + paymentsCount}` }
    }
    
    XLSX.utils.book_append_sheet(workbook, debtsSheet, 'חובות מוסדות')
    
    setExportProgress(90)
    
    // ============================================
    // שמירה והורדת קובץ
    // ============================================
    const fileName = (() => {
      const date = new Date().toLocaleDateString('he-IL').replace(/\./g, '-')
      if (exportType === 'all') return `דוח-כללי-${date}.xlsx`
      if (exportType === 'institutions' && selectedExportInstitutions.length === 1) {
        const inst = filteredInstitutions[0]
        return `${inst.name}-${date}.xlsx`
      }
      if (exportType === 'groups' && selectedExportGroups.length === 1) {
        const group = filteredGroups[0]
        return `${group.name}-${date}.xlsx`
      }
      if (exportType === 'dates') return `דוח-תאריכים-${date}.xlsx`
      return `דוח-שוברים-${date}.xlsx`
    })()
    
    XLSX.writeFile(workbook, fileName)
    
    setExportProgress(100)
    toast.success('הקובץ הורד בהצלחה!')
    
  } catch (error: any) {
    toast.error('שגיאה בייצוא: ' + error.message)
  } finally {
    setIsExporting(false)
    setExportProgress(0)
  }
}
