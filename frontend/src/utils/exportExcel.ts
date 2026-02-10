import * as XLSX from 'xlsx-js-style'
import { supabase } from './supabase'
import toast from 'react-hot-toast'

// ============================================
// GLOBAL STYLING UTILITIES
// ============================================

/**
 * כותרת טבלה: רקע אפור, טקסט מודגש וממורכז
 */
const createHeaderStyle = () => ({
  font: { bold: true, sz: 11 },
  fill: { fgColor: { rgb: 'D9D9D9' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  }
})

/**
 * סגנון גבול רגיל לכל תא בטבלה
 */
const createBorderStyle = () => ({
  border: {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  }
})

/**
 * כותרת מדור: כחול, גדול, מודגש
 */
const createTitleStyle = () => ({
  font: { bold: true, sz: 16, color: { rgb: '1F4E78' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  fill: { fgColor: { rgb: 'D9E1F2' } }
})

/**
 * כותרת Section (לפני טבלה): כתום בהיר, מודגש
 */
const createSectionHeaderStyle = () => ({
  font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: 'ED7D31' } },
  alignment: { horizontal: 'center', vertical: 'center' }
})

/**
 * המרת מספר לפורמט כספי
 */
const currencyToNumber = (value: number): number => {
  return Math.round(value * 100) / 100
}

/**
 * חישוב רוחב עמודה אוטומטי עם padding
 */
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

  return columnWidths.map(width => ({ wch: Math.min(width + 2, 50) }))
}

/**
 * הגדרת RTL לגיליון
 */
function setRTL(sheet: any) {
  if (!sheet['!views']) sheet['!views'] = [{}]
  sheet['!views'][0].rightToLeft = true
}

/**
 * יצירת עמודת רווח (עמודה A ריקה)
 */
function addSpacerColumn(sheet: any) {
  if (!sheet['!cols']) sheet['!cols'] = []
  sheet['!cols'][0] = { wch: 2 } // עמודה A ברוחב 2 תווים
}

/**
 * איחוד תאים
 */
function mergeCells(sheet: any, range: string) {
  if (!sheet['!merges']) sheet['!merges'] = []
  sheet['!merges'].push(XLSX.utils.decode_range(range))
}

/**
 * החלת סגנון רקע לטווח תאים
 */
function applyStyleToRange(sheet: any, range: string, style: any) {
  const decoded = XLSX.utils.decode_range(range)
  for (let R = decoded.s.r; R <= decoded.e.r; ++R) {
    for (let C = decoded.s.c; C <= decoded.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
      if (!sheet[cellAddress]) sheet[cellAddress] = { t: 's', v: '' }
      sheet[cellAddress].s = { ...sheet[cellAddress].s, ...style }
    }
  }
}

// ============================================
// TYPES
// ============================================

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

// ============================================
// MAIN EXPORT FUNCTION
// ============================================

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

    // ============================================
    // שלב 1: סינון נתונים
    // ============================================
    let filteredInstitutions = institutions || []
    let filteredGroups = groups || []
    let filteredTransactions = transactions || []

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

    setExportProgress(40)

    const workbook = XLSX.utils.book_new()

    // ============================================
    // גיליון 1: סיכום כללי (DASHBOARD)
    // ============================================

    const summaryData: any[][] = [
      [''], // שורה 1: ריקה (עמודה A)
      ['', 'מערכת ניהול שוברים - דוח מרוכז'], // שורה 2: כותרת ראשית
      ['', `תאריך ייצוא: ${new Date().toLocaleDateString('he-IL')}`],
      [''],
      ['', '📊 סטטיסטיקות כלליות:'],
      ['', `מספר מוסדות: ${filteredInstitutions.length}`],
      ['', `מספר קבוצות: ${filteredGroups.length}`],
      ['', `מספר עסקאות: ${filteredTransactions.length}`],
      ['', `סה"כ תלושים נטו: ${currencyToNumber(filteredTransactions.reduce((sum, t) => sum + (t.net_amount || 0), 0))} ₪`],
      ['', `סה"כ הסבסוד שלי: ${currencyToNumber(filteredTransactions.reduce((sum, t) => sum + (t.my_subsidy_amount || 0), 0))} ₪`],
      ['', `סה"כ סבסוד מוסדות: ${currencyToNumber(filteredTransactions.reduce((sum, t) => sum + (t.institution_subsidy_amount || 0), 0))} ₪`],
      ['', `סה"כ חובות פתוחים: ${currencyToNumber(filteredInstitutions.reduce((sum, i) => sum + (i.total_debt || 0), 0))} ₪`],
      [''],
      ['', '📋 פירוט מוסדות:'],
      ['', 'שם המוסד', 'מספר קבוצות', 'תלושים נטו (₪)', 'הסבסוד שלי (₪)', 'סבסוד מוסד (₪)', 'חוב פתוח (₪)'],
      ...filteredInstitutions.map(inst => [
        '',
        inst.name,
        filteredGroups.filter(g => g.institution_id === inst.id).length,
        currencyToNumber(inst.total_net_amount || 0),
        currencyToNumber(inst.total_my_subsidy || 0),
        currencyToNumber(inst.total_institution_subsidy || 0),
        currencyToNumber(inst.total_debt || 0)
      ])
    ]

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)

    // RTL
    setRTL(summarySheet)

    // עמודת רווח
    addSpacerColumn(summarySheet)

    // מיזוג תאים: כותרת ראשית
    mergeCells(summarySheet, 'B2:H2')
    applyStyleToRange(summarySheet, 'B2:H2', createTitleStyle())

    // מיזוג תאים: תאריך ייצוא
    mergeCells(summarySheet, 'B3:H3')

    // מיזוג תאים: סטטיסטיקות (כל שורה)
    for (let row = 5; row <= 12; row++) {
      mergeCells(summarySheet, `B${row}:H${row}`)
    }

    // סטיילינג כותרת טבלה (שורה 15)
    for (let col = 1; col <= 7; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 14, c: col })
      if (summarySheet[cellAddress]) {
        summarySheet[cellAddress].s = createHeaderStyle()
      }
    }

    // גבולות לכל התאים בטבלה (מ-15 ועד סוף)
    for (let row = 15; row < summaryData.length; row++) {
      for (let col = 1; col <= 7; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
        if (summarySheet[cellAddress]) {
          summarySheet[cellAddress].s = {
            ...summarySheet[cellAddress].s,
            ...createBorderStyle()
          }
        }
      }
    }

    // רוחב עמודות
    summarySheet['!cols'] = calculateColumnWidth(summaryData)

    // Auto-filter על הטבלה
    summarySheet['!autofilter'] = { ref: `B15:H${summaryData.length}` }

    // Freeze panes
    summarySheet['!freeze'] = { xSplit: 0, ySplit: 15, topLeftCell: 'B16', activePane: 'bottomRight' }

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'סיכום כללי')

    setExportProgress(55)

    // ============================================
    // גיליון 2: חובות מוסדות (3 SECTIONS)
    // ============================================

    const totalActiveDebt = filteredInstitutions.reduce((sum, i) => sum + (i.total_debt || 0), 0)
    const totalPaymentsThisYear = payments?.filter(p => new Date(p.payment_date).getFullYear() === new Date().getFullYear()).reduce((sum, p) => sum + (p.amount || 0), 0) || 0

    const debtsData: any[][] = [
      [''], // עמודת רווח
      ['', '📊 סיכום חובות'], // כותרת Section 1
      ['', `סה"כ חובות פתוחים: ${currencyToNumber(totalActiveDebt)} ₪`],
      ['', `מספר מוסדות עם חוב: ${filteredInstitutions.filter(i => (i.total_debt || 0) > 0).length}`],
      ['', `סה"כ תשלומים השנה: ${currencyToNumber(totalPaymentsThisYear)} ₪`],
      [''],
      [''],
      ['', '📋 פירוט חובות לפי מוסד'], // כותרת Section 2
      ['', 'שם מוסד', 'חוב נוכחי (₪)', 'סה"כ סבסוד מוסד (₪)', 'סה"כ תשלומים (₪)', 'מספר תשלומים', 'תאריך עדכון'],
      ...filteredInstitutions
        .filter(i => (i.total_debt || 0) > 0)
        .map(inst => {
          const instPayments = payments?.filter(p => p.institution_id === inst.id) || []
          return [
            '',
            inst.name,
            currencyToNumber(inst.total_debt || 0),
            currencyToNumber(inst.total_institution_subsidy || 0),
            currencyToNumber(instPayments.reduce((sum, p) => sum + (p.amount || 0), 0)),
            instPayments.length,
            new Date(inst.updated_at).toLocaleDateString('he-IL')
          ]
        })
    ]

    const debtInstitutionsCount = filteredInstitutions.filter(i => (i.total_debt || 0) > 0).length
    const paymentsStartRow = 10 + debtInstitutionsCount + 2

    debtsData.push([''])
    debtsData.push([''])
    debtsData.push(['', '💰 היסטוריית תשלומים']) // כותרת Section 3
    debtsData.push(['', 'תאריך', 'שם מוסד', 'סכום תשלום (₪)', 'הערות'])

    const relevantPayments = payments?.filter(p => {
      const inst = filteredInstitutions.find(i => i.id === p.institution_id)
      return inst !== undefined
    }) || []

    relevantPayments.forEach(payment => {
      const inst = filteredInstitutions.find(i => i.id === payment.institution_id)
      debtsData.push([
        '',
        new Date(payment.payment_date).toLocaleDateString('he-IL'),
        inst?.name || '',
        currencyToNumber(payment.amount),
        payment.notes || '-'
      ])
    })

    const debtsSheet = XLSX.utils.aoa_to_sheet(debtsData)

    // RTL
    setRTL(debtsSheet)

    // עמודת רווח
    addSpacerColumn(debtsSheet)

    // מיזוג כותרת Section 1 (שורה 2)
    mergeCells(debtsSheet, 'B2:E2')
    applyStyleToRange(debtsSheet, 'B2:E2', createSectionHeaderStyle())

    // מיזוג שורות סטטיסטיקות
    mergeCells(debtsSheet, 'B3:E3')
    mergeCells(debtsSheet, 'B4:E4')
    mergeCells(debtsSheet, 'B5:E5')

    // מיזוג כותרת Section 2 (שורה 8)
    mergeCells(debtsSheet, 'B8:H8')
    applyStyleToRange(debtsSheet, 'B8:H8', createSectionHeaderStyle())

    // סטיילינג כותרת טבלה חובות (שורה 9)
    for (let col = 1; col <= 7; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 8, c: col })
      if (debtsSheet[cellAddress]) {
        debtsSheet[cellAddress].s = createHeaderStyle()
      }
    }

    // גבולות לטבלת חובות
    for (let row = 9; row < 10 + debtInstitutionsCount; row++) {
      for (let col = 1; col <= 7; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
        if (debtsSheet[cellAddress]) {
          debtsSheet[cellAddress].s = {
            ...debtsSheet[cellAddress].s,
            ...createBorderStyle()
          }
        }
      }
    }

    // מיזוג כותרת Section 3
    const paymentHeaderRow = paymentsStartRow + 1
    mergeCells(debtsSheet, `B${paymentHeaderRow + 1}:E${paymentHeaderRow + 1}`)
    applyStyleToRange(debtsSheet, `B${paymentHeaderRow + 1}:E${paymentHeaderRow + 1}`, createSectionHeaderStyle())

    // סטיילינג כותרת טבלה תשלומים
    for (let col = 1; col <= 4; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: paymentHeaderRow + 1, c: col })
      if (debtsSheet[cellAddress]) {
        debtsSheet[cellAddress].s = createHeaderStyle()
      }
    }

    // גבולות לטבלת תשלומים
    for (let row = paymentHeaderRow + 2; row < debtsData.length; row++) {
      for (let col = 1; col <= 4; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
        if (debtsSheet[cellAddress]) {
          debtsSheet[cellAddress].s = {
            ...debtsSheet[cellAddress].s,
            ...createBorderStyle()
          }
        }
      }
    }

    // רוחב עמודות
    debtsSheet['!cols'] = calculateColumnWidth(debtsData)

    // Auto-filter על טבלת חובות
    if (debtInstitutionsCount > 0) {
      debtsSheet['!autofilter'] = { ref: `B9:H${9 + debtInstitutionsCount}` }
    }

    XLSX.utils.book_append_sheet(workbook, debtsSheet, 'חובות מוסדות')

    setExportProgress(70)

    // ============================================
    // גיליון 3: כל העסקאות (TRANSACTIONS)
    // ============================================

    const transactionsData: any[][] = [
      ['', 'תאריך', 'מוסד', 'קבוצה', 'שם לקוח', 'טלפון', 'ת.ז', 'סכום ששולם (₪)', 'הסבסוד שלי (₪)', 'סבסוד מוסד (₪)', 'סה"כ סבסוד (₪)', 'שווי נטו (₪)', 'תלושים', 'לא מנוצל (₪)', 'מקור'],
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
          '',
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

    // RTL
    setRTL(transactionsSheet)

    // עמודת רווח
    addSpacerColumn(transactionsSheet)

    // סטיילינג כותרת (שורה 1)
    for (let col = 1; col <= 14; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      if (transactionsSheet[cellAddress]) {
        transactionsSheet[cellAddress].s = createHeaderStyle()
      }
    }

    // גבולות + פורמט לכל התאים
    for (let row = 1; row < transactionsData.length; row++) {
      for (let col = 1; col <= 14; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
        if (transactionsSheet[cellAddress]) {
          transactionsSheet[cellAddress].s = {
            ...transactionsSheet[cellAddress].s,
            ...createBorderStyle()
          }

          // פורמט מספרים: עמודות 7-13 (כסף)
          if ([7, 8, 9, 10, 11, 13].includes(col)) {
            transactionsSheet[cellAddress].z = '#,##0.00'
          }
        }
      }
    }

    // רוחב עמודות
    transactionsSheet['!cols'] = calculateColumnWidth(transactionsData)

    // Auto-filter
    transactionsSheet['!autofilter'] = { ref: `B1:O${transactionsData.length}` }

    // Freeze panes: שורה 1 + 3 עמודות ראשונות
    transactionsSheet['!freeze'] = { xSplit: 4, ySplit: 1, topLeftCell: 'E2', activePane: 'bottomRight' }

    XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'כל העסקאות')

    setExportProgress(85)

    // ============================================
    // גיליון 4: מוסדות וקבוצות
    // ============================================

    const groupsData: any[][] = [
      ['', 'שם מוסד', 'שם קבוצה', 'מספר עסקאות', 'תלושים נטו (₪)', 'הסבסוד שלי (₪)', 'סבסוד מוסד (₪)', 'תאריך עדכון'],
      ...filteredGroups.map(group => {
        const inst = filteredInstitutions.find(i => i.id === group.institution_id)
        return [
          '',
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

    // RTL
    setRTL(groupsSheet)

    // עמודת רווח
    addSpacerColumn(groupsSheet)

    // סטיילינג כותרת
    for (let col = 1; col <= 7; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      if (groupsSheet[cellAddress]) {
        groupsSheet[cellAddress].s = createHeaderStyle()
      }
    }

    // גבולות + פורמט
    for (let row = 1; row < groupsData.length; row++) {
      for (let col = 1; col <= 7; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
        if (groupsSheet[cellAddress]) {
          groupsSheet[cellAddress].s = {
            ...groupsSheet[cellAddress].s,
            ...createBorderStyle()
          }

          // פורמט מספרים: עמודות 4-6
          if ([4, 5, 6].includes(col)) {
            groupsSheet[cellAddress].z = '#,##0.00'
          }
        }
      }
    }

    // רוחב עמודות
    groupsSheet['!cols'] = calculateColumnWidth(groupsData)

    // Auto-filter
    groupsSheet['!autofilter'] = { ref: `B1:H${groupsData.length}` }

    // Freeze panes
    groupsSheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'B2', activePane: 'bottomRight' }

    XLSX.utils.book_append_sheet(workbook, groupsSheet, 'מוסדות וקבוצות')

    setExportProgress(95)

    // ============================================
    // שמירה והורדה
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
