import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { calculateVouchers, formatCurrency } from './utils/calculations'
import { exportToExcel } from './utils/exportExcel'
import { createVouchersForTransaction, getVouchersByTransaction } from './utils/vouchers'
import { VoucherTile, VoucherPrintView, PrintVouchersModal } from './components/Vouchers'
import { DebtManagementRoutes } from './pages/DebtManagement'
import { SyncManagementPage } from './pages/SyncManagement'
import type { Voucher } from './types'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function HomePage() {
  const [showModal, setShowModal] = useState(false)
  const [showExcelPreviewModal, setShowExcelPreviewModal] = useState(false)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [excelData, setExcelData] = useState<any[]>([])
  const [excelError, setExcelError] = useState('')
  const [selectedInstitution, setSelectedInstitution] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [newInstitutionName, setNewInstitutionName] = useState('')
  const [newGroupData, setNewGroupData] = useState<any>({
    name: '',
    nedarim_groupe_name: '',
    my_subsidy_percent: '',
    institution_subsidy_percent: '',
    voucher_50_percent: '',
    voucher_100_percent: '',
    voucher_150_percent: '',
    voucher_200_percent: '',
  })
  
  // ייצוא Excel - States
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportType, setExportType] = useState<'all' | 'institutions' | 'groups' | 'dates'>('all')
  const [showExportSelectModal, setShowExportSelectModal] = useState(false)
  const [selectedExportInstitutions, setSelectedExportInstitutions] = useState<string[]>([])
  const [selectedExportGroups, setSelectedExportGroups] = useState<string[]>([])
  const [exportDateFrom, setExportDateFrom] = useState('')
  const [exportDateTo, setExportDateTo] = useState('')
  const [exportProgress, setExportProgress] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [showExportMethodModal, setShowExportMethodModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [exportEmail, setExportEmail] = useState('')
  
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  
  const { data: institutions, isLoading } = useQuery({
    queryKey: ['institutions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('institutions').select('*').order('name')
      if (error) throw error
      return data
    }
  })
  
  const { data: transactions } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select('*')
      if (error) throw error
      return data
    }
  })
  
  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data, error } = await supabase.from('groups').select('*')
      if (error) throw error
      return data
    }
  })
  
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from('institutions').insert({ name }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
      toast.success('מוסד נוצר בהצלחה')
      setShowModal(false)
      setNewName('')
    },
    onError: (error: any) => {
      toast.error('שגיאה ביצירת מוסד: ' + error.message)
    }
  })
  
  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase.from('institutions').update({ name }).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
      toast.success('מוסד עודכן בהצלחה')
      setShowModal(false)
      setEditingId(null)
    },
    onError: (error: any) => {
      toast.error('שגיאה בעדכון מוסד: ' + error.message)
    }
  })
  
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('institutions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
      toast.success('מוסד נמחק בהצלחה')
    },
    onError: (error: any) => {
      toast.error('שגיאה במחיקת מוסד: ' + error.message)
    }
  })
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // בדיקת סוג קובץ
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setExcelError('סוג קובץ לא נתמך. נדרש קובץ Excel (.xlsx או .xls)')
      return
    }
    
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        
        // בדיקה שיש sheets בקובץ
        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          setExcelError('הקובץ לא תקין - אין גיליונות בקובץ Excel')
          return
        }
        
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws)
        
        // בדיקת קובץ ריק
        if (data.length === 0) {
          setExcelError('הקובץ ריק - לא נמצאו שורות')
          return
        }
        
        const firstRow: any = data[0]
        const requiredColumns = ['שם לקוח', 'סכום ששולם', 'קבוצה']
        
        // בדיקת עמודות חובה
        const missingColumns = requiredColumns.filter(col => !(col in firstRow))
        if (missingColumns.length > 0) {
          setExcelError(`חסרות עמודות חובה: ${missingColumns.join(', ')}`)
          return
        }
        
        // וולידציה מפורטת לכל שורה
        for (let i = 0; i < data.length; i++) {
          const row: any = data[i]
          const rowNum = i + 2 // +2 כי שורה 1 היא כותרות
          
          // בדיקת שם לקוח
          if (!row['שם לקוח'] || String(row['שם לקוח']).trim() === '') {
            setExcelError(`שורה ${rowNum}: שם לקוח ריק`)
            return
          }
          
          // בדיקת סכום
          const amount = row['סכום ששולם']
          if (!amount) {
            setExcelError(`שורה ${rowNum}: סכום ששולם ריק`)
            return
          }
          if (isNaN(parseFloat(amount))) {
            setExcelError(`שורה ${rowNum}: סכום ששולם אינו מספר תקין ("${amount}")`)
            return
          }
          if (parseFloat(amount) <= 0) {
            setExcelError(`שורה ${rowNum}: סכום ששולם חייב להיות גדול מאפס`)
            return
          }
          
          // בדיקת קבוצה
          if (!row['קבוצה'] || String(row['קבוצה']).trim() === '') {
            setExcelError(`שורה ${rowNum}: קבוצה ריקה`)
            return
          }
        }
        
        // הכל תקין!
        setExcelData(data)
        setExcelError('')
        setShowExcelPreviewModal(false)
        setShowExcelModal(true)
      } catch (error: any) {
        setExcelError('שגיאה בקריאת הקובץ: ' + error.message)
      }
    }
    reader.readAsBinaryString(file)
    // איפוס ה-input
    e.target.value = ''
  }
  
  const uploadExcelMutation = useMutation({
    mutationFn: async () => {
      let groupId = selectedGroup
      let institutionId = selectedInstitution
      
      // יצירת מוסד חדש אם צריך
      if (!institutionId && newInstitutionName) {
        const { data: newInst, error } = await supabase.from('institutions').insert({ name: newInstitutionName }).select().single()
        if (error) throw error
        institutionId = newInst.id
      }
      
      // יצירת קבוצה חדשה אם צריך
      if (!groupId && newGroupData.name) {
        // המרת מחרוזות למספרים
        const v50 = parseFloat(newGroupData.voucher_50_percent) || 0
        const v100 = parseFloat(newGroupData.voucher_100_percent) || 0
        const v150 = parseFloat(newGroupData.voucher_150_percent) || 0
        const v200 = parseFloat(newGroupData.voucher_200_percent) || 0
        const vouchersSum = v50 + v100 + v150 + v200
        
        // בדיקה שאחוזי התלושים = 100%
        if (Math.abs(vouchersSum - 100) > 0.01) {
          throw new Error(`סכום אחוזי התלושים חייב להיות 100% בדיוק (כרגע: ${vouchersSum.toFixed(1)}%)`)
        }
        
        // המרה למספרים לשמירה
        const groupDataToSave = {
          name: newGroupData.name,
          nedarim_groupe_name: newGroupData.nedarim_groupe_name,
          my_subsidy_percent: parseFloat(newGroupData.my_subsidy_percent) || 0,
          institution_subsidy_percent: parseFloat(newGroupData.institution_subsidy_percent) || 0,
          voucher_50_percent: v50,
          voucher_100_percent: v100,
          voucher_150_percent: v150,
          voucher_200_percent: v200,
          institution_id: institutionId
        }
        
        const { data: newGrp, error } = await supabase.from('groups').insert(groupDataToSave).select().single()
        if (error) throw error
        groupId = newGrp.id
      }
      
      if (!groupId || !institutionId) {
        throw new Error('יש לבחור או ליצור מוסד וקבוצה')
      }
      
      // שליפת פרטי הקבוצה
      const { data: group, error: groupError } = await supabase.from('groups').select('*').eq('id', groupId).single()
      if (groupError) throw groupError
      
      // הכנת העסקאות
      const transactions = excelData.map((row: any) => {
        const amountPaid = parseFloat(row['סכום ששולם'])
        const mySubsidy = Math.round(amountPaid * group.my_subsidy_percent) / 100
        const instSubsidy = Math.round(amountPaid * group.institution_subsidy_percent) / 100
        const netAmount = amountPaid + mySubsidy + instSubsidy
        
        // חישוב תלושים מתוקן - מתוך calculations.ts
        const vouchers = calculateVouchers(netAmount, {
          voucher_50_percent: group.voucher_50_percent,
          voucher_100_percent: group.voucher_100_percent,
          voucher_150_percent: group.voucher_150_percent,
          voucher_200_percent: group.voucher_200_percent,
        })
        
        // יצירת ID אקראי (11 ספרות + אותיות)
        const randomId = 'XL' + Math.random().toString(36).substring(2, 11).toUpperCase()
        
        // תאריך אוטומטי - זמן העלאה למערכת
        const transactionTime = new Date().toISOString()
        
        return {
          nedarim_transaction_id: randomId,
          client_name: row['שם לקוח'],
          client_phone: row['טלפון'] || null,
          client_email: null, // לא נדרש בקובץ Excel
          client_id_number: row['תעודת זהות'] || null,
          amount_paid: amountPaid,
          transaction_time: transactionTime,
          nedarim_groupe: row['קבוצה'],
          group_id: groupId,
          institution_id: institutionId,
          my_subsidy_amount: mySubsidy,
          institution_subsidy_amount: instSubsidy,
          // total_subsidy ו-net_amount מחושבים אוטומטית במסד הנתונים
          vouchers_50: vouchers.vouchers_50,
          vouchers_100: vouchers.vouchers_100,
          vouchers_150: vouchers.vouchers_150,
          vouchers_200: vouchers.vouchers_200,
          unused_amount: vouchers.unused_amount,
          has_unused_warning: vouchers.unused_amount > 0.01,
          source: 'excel'
        }
      })
      
      // שמירה ב-DB
      const { data: insertedTransactions, error } = await supabase
        .from('transactions')
        .insert(transactions)
        .select()
      
      if (error) throw error
      if (!insertedTransactions) throw new Error('Failed to get inserted transactions')
      
      // יצירת תלושים פיזיים לכל עסקה
      for (const transaction of insertedTransactions) {
        await createVouchersForTransaction(transaction)
      }
      
      return insertedTransactions.length
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      toast.success(`${count} עסקאות נוספו בהצלחה!`)
      setShowExcelModal(false)
      setExcelData([])
      setSelectedInstitution('')
      setSelectedGroup('')
      setNewInstitutionName('')
    },
    onError: (error: any) => {
      toast.error('שגיאה בהעלאת קובץ: ' + error.message)
    }
  })
  
  const handleOpenAddModal = () => {
    setEditingId(null)
    setNewName('')
    setShowModal(true)
  }
  
  const handleOpenEditModal = (inst: any) => {
    setEditingId(inst.id)
    setNewName(inst.name)
    setShowModal(true)
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    
    if (editingId) {
      updateMutation.mutate({ id: editingId, name: newName.trim() })
    } else {
      createMutation.mutate(newName.trim())
    }
  }
  
  const handleDelete = (inst: any) => {
    if (confirm(`האם אתה בטוח שברצונך למחוק את "${inst.name}"? פעולה זו בלתי הפיכה!`)) {
      deleteMutation.mutate(inst.id)
    }
  }
  
  // ============================================
  // פונקציית ייצוא Excel
  // ============================================
  const handleExportExcel = async () => {
    await exportToExcel({
      exportType,
      institutions: institutions || [],
      groups: groups || [],
      transactions: transactions || [],
      selectedExportInstitutions,
      selectedExportGroups,
      exportDateFrom,
      exportDateTo,
      setExportProgress,
      setIsExporting
    })
  }
  
  const stats = {
    totalNetAmount: transactions?.reduce((sum, t) => sum + (t.net_amount || 0), 0) || 0,
    totalMySubsidy: transactions?.reduce((sum, t) => sum + (t.my_subsidy_amount || 0), 0) || 0,
    totalDebt: institutions?.reduce((sum, i) => sum + (i.total_debt || 0), 0) || 0,
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען נתונים...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <svg className="w-10 h-10 text-blue-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="4" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M8 4V2M16 4V2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="4" y1="9" x2="20" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 2"/>
                  <circle cx="12" cy="15" r="2" fill="currentColor"/>
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900">מערכת ניהול שוברים</h1>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setExcelError('')
                  setExcelData([])
                  setSelectedInstitution('')
                  setSelectedGroup('')
                  setNewInstitutionName('')
                  setNewGroupData({
                    name: '',
                    nedarim_groupe_name: '',
                    my_subsidy_percent: '',
                    institution_subsidy_percent: '',
                    voucher_50_percent: '',
                    voucher_100_percent: '',
                    voucher_150_percent: '',
                    voucher_200_percent: '',
                  })
                  setShowExcelPreviewModal(true)
                }}
                className="group relative px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl cursor-pointer shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="font-medium">ייבא Excel</span>
              </button>
              
              <button
                onClick={() => setShowExportModal(true)}
                className="group relative px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-medium">ייצא Excel</span>
              </button>
              
              <button
                onClick={() => navigate('/debt-management')}
                className="group relative px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="font-medium">ניהול חוב מוסדות</span>
              </button>
              
              <button
                onClick={() => navigate('/sync-management')}
                className="group relative px-4 py-2 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-lg shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200 flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-medium">ניהול API</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">דף הבית</h2>
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">שווי תלושים נטו (סה״כ)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.totalNetAmount)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-2xl">
                💰
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">הסבסוד שלי (סה״כ)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.totalMySubsidy)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-100 text-green-600 flex items-center justify-center text-2xl">
                💚
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">חוב מוסדות (סה״כ)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.totalDebt)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-2xl">
                📊
              </div>
            </div>
          </div>
        </div>
        
        {/* Institutions List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              מוסדות ({institutions?.length || 0})
            </h3>
          </div>
          
          {institutions && institutions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">אין מוסדות עדיין</p>
              <button
                onClick={handleOpenAddModal}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                הוסף מוסד ראשון
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {institutions?.map((inst: any) => {
                // ספירת קבוצות באותו מוסד
                const groupCount = groups?.filter(g => g.institution_id === inst.id).length || 0
                
                return (
                  <div 
                    key={inst.id} 
                    className="bg-white rounded-lg shadow-sm p-4 hover:shadow-lg transition-shadow relative group cursor-pointer"
                    onClick={() => navigate(`/institution/${inst.id}`)}
                  >
                    {/* Menu Button */}
                    <div className="absolute top-4 left-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const menu = e.currentTarget.nextElementSibling as HTMLElement
                          menu.classList.toggle('hidden')
                        }}
                        className="text-gray-400 hover:text-gray-600 p-1"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      
                      <div className="hidden absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border py-1 min-w-[120px] z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEditModal(inst)
                          }}
                          className="w-full px-4 py-2 text-right hover:bg-gray-50"
                        >
                          ✏️ עריכה
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(inst)
                          }}
                          className="w-full px-4 py-2 text-right hover:bg-gray-50 text-red-600"
                        >
                          🗑️ מחיקה
                        </button>
                      </div>
                    </div>
                    
                    <div className="pr-8">
                      <h4 className="text-lg font-semibold text-gray-900 mb-1">
                        {inst.name}
                      </h4>
                      <p className="text-sm text-gray-500 mb-3">{groupCount} קבוצות</p>
                    
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">שווי נטו</p>
                        <p className="text-sm font-semibold text-blue-600">
                          {formatCurrency(inst.total_net_amount || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">הסבסוד שלי</p>
                        <p className="text-sm font-semibold text-green-600">
                          {formatCurrency(inst.total_my_subsidy || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">סבסוד מוסד</p>
                        <p className="text-sm font-semibold text-orange-600">
                          {formatCurrency(inst.total_institution_subsidy || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">חוב המוסד</p>
                        <p className="text-sm font-semibold text-red-600">
                          {formatCurrency(inst.total_debt || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
      
      {/* Floating Action Button */}
      <button
        onClick={handleOpenAddModal}
        className="fixed bottom-6 left-6 w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-full shadow-xl hover:shadow-2xl hover:scale-110 transition-all duration-300 flex items-center justify-center group"
      >
        <svg className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
        </svg>
      </button>
      
      {/* Excel Preview Modal - דוגמת פורמט */}
      {showExcelPreviewModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => {
            setShowExcelPreviewModal(false)
            setExcelError('')
          }} />
          
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                העלאת קובץ Excel
              </h3>
              
              {/* Error Display */}
              {excelError && (
                <div className="mb-4 p-4 bg-red-50 border-r-4 border-red-500 rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 className="font-semibold text-red-900 mb-1">שגיאה בקובץ</h4>
                      <p className="text-sm text-red-800">{excelError}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Format Example */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">פורמט הקובץ הנדרש:</h4>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-blue-50">
                        <th className="border border-gray-300 px-4 py-2 text-right font-semibold text-gray-900">
                          שם לקוח <span className="text-red-500">*</span>
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-right font-semibold text-gray-900">
                          טלפון
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-right font-semibold text-gray-900">
                          תעודת זהות
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-right font-semibold text-gray-900">
                          סכום ששולם <span className="text-red-500">*</span>
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-right font-semibold text-gray-900">
                          קבוצה <span className="text-red-500">*</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-white hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2 text-gray-700">ישראל ישראלי</td>
                        <td className="border border-gray-300 px-4 py-2 text-gray-700">050-1234567</td>
                        <td className="border border-gray-300 px-4 py-2 text-gray-700">123456789</td>
                        <td className="border border-gray-300 px-4 py-2 text-gray-700">100</td>
                        <td className="border border-gray-300 px-4 py-2 text-gray-700">כיתה א</td>
                      </tr>
                      <tr className="bg-gray-50 hover:bg-gray-100">
                        <td className="border border-gray-300 px-4 py-2 text-gray-700">שרה כהן</td>
                        <td className="border border-gray-300 px-4 py-2 text-gray-400 italic">-</td>
                        <td className="border border-gray-300 px-4 py-2 text-gray-700">987654321</td>
                        <td className="border border-gray-300 px-4 py-2 text-gray-700">250</td>
                        <td className="border border-gray-300 px-4 py-2 text-gray-700">כיתה ב</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-gray-600">
                    <span className="text-red-500 font-bold">*</span> שדות חובה: <strong>שם לקוח, סכום ששולם, קבוצה</strong>
                  </p>
                  <p className="text-sm text-gray-600">
                    ℹ️ שדות אופציונליים: טלפון, תעודת זהות
                  </p>
                  <p className="text-sm text-gray-600">
                    📅 התאריך והשעה יירשמו אוטומטית בזמן ההעלאה
                  </p>
                </div>
              </div>
              
              {/* File Upload Button */}
              <div className="flex items-center justify-center gap-4 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowExcelPreviewModal(false)
                    setExcelError('')
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                >
                  ביטול
                </button>
                
                <label className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 cursor-pointer font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>בחירת קובץ Excel</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowModal(false)} />
          
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {editingId ? 'עריכת מוסד' : 'הוספת מוסד חדש'}
              </h3>
              
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    שם המוסד
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="לדוגמה: בית ספר תורני"
                    required
                    autoFocus
                  />
                </div>
                
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      setEditingId(null)
                      setNewName('')
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    ביטול
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                    disabled={!newName.trim() || createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'שומר...' : editingId ? 'עדכן' : 'צור מוסד'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Excel Upload Modal */}
      {showExcelModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => {
            setShowExcelModal(false)
            setExcelData([])
            setSelectedInstitution('')
            setSelectedGroup('')
            setNewInstitutionName('')
          }} />
          
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                העלאת עסקאות מקובץ Excel
              </h3>
              
              <div className="mb-6 p-4 bg-green-50 rounded-lg border-r-4 border-green-500">
                <p className="text-sm font-semibold text-green-900 mb-2">✅ קובץ תקין!</p>
                <div className="text-sm text-green-800">
                  <p>נמצאו {excelData.length} שורות</p>
                  <p className="text-xs mt-2 text-gray-600">
                    עכשיו בחר לאיזה מוסד וקבוצה לשייך את העסקאות
                  </p>
                </div>
              </div>
              
              <form onSubmit={(e) => { e.preventDefault(); uploadExcelMutation.mutate() }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    בחר מוסד קיים
                  </label>
                  <select
                    value={selectedInstitution}
                    onChange={(e) => {
                      setSelectedInstitution(e.target.value)
                      setNewInstitutionName('')
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- בחר מוסד --</option>
                    {institutions?.map((inst: any) => (
                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                    ))}
                  </select>
                  
                  <div className="mt-2 text-center text-sm text-gray-500">או</div>
                  
                  <input
                    type="text"
                    placeholder="צור מוסד חדש"
                    value={newInstitutionName}
                    onChange={(e) => {
                      setNewInstitutionName(e.target.value)
                      setSelectedInstitution('')
                    }}
                    className="w-full mt-2 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                {(selectedInstitution || newInstitutionName) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      בחר קבוצה קיימת
                    </label>
                    <select
                      value={selectedGroup}
                      onChange={(e) => {
                        setSelectedGroup(e.target.value)
                        setNewGroupData({ ...newGroupData, name: '' })
                      }}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- בחר קבוצה --</option>
                      {groups?.filter((g: any) => g.institution_id === selectedInstitution).map((g: any) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    
                    <div className="mt-2 text-center text-sm text-gray-500">או</div>
                    
                    <div className="mt-2 p-4 border rounded-lg bg-gray-50">
                      <p className="text-sm font-semibold text-gray-700 mb-3">צור קבוצה חדשה:</p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="שם הקבוצה"
                          value={newGroupData.name}
                          onChange={(e) => {
                            setNewGroupData({ ...newGroupData, name: e.target.value })
                            setSelectedGroup('')
                          }}
                          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        
                        <input
                          type="text"
                          placeholder="שם בנדרים"
                          value={newGroupData.nedarim_groupe_name}
                          onChange={(e) => setNewGroupData({ ...newGroupData, nedarim_groupe_name: e.target.value })}
                          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        
                        <input
                          type="number"
                          placeholder="הסבסוד שלי (%)"
                          value={newGroupData.my_subsidy_percent}
                          onChange={(e) => setNewGroupData({ ...newGroupData, my_subsidy_percent: e.target.value })}
                          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          step="0.01"
                        />
                        
                        <input
                          type="number"
                          placeholder="סבסוד המוסד (%)"
                          value={newGroupData.institution_subsidy_percent}
                          onChange={(e) => setNewGroupData({ ...newGroupData, institution_subsidy_percent: e.target.value })}
                          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          step="0.01"
                        />
                      </div>
                      
                      <p className="text-xs text-gray-600 mt-3 mb-2">חלוקת תלושים (חייב להסתכם ל-100%):</p>
                      <div className="grid grid-cols-4 gap-2">
                        <input
                          type="number"
                          placeholder="50₪"
                          value={newGroupData.voucher_50_percent}
                          onChange={(e) => setNewGroupData({ ...newGroupData, voucher_50_percent: e.target.value })}
                          className="px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                          step="0.01"
                        />
                        <input
                          type="number"
                          placeholder="100₪"
                          value={newGroupData.voucher_100_percent}
                          onChange={(e) => setNewGroupData({ ...newGroupData, voucher_100_percent: e.target.value })}
                          className="px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                          step="0.01"
                        />
                        <input
                          type="number"
                          placeholder="150₪"
                          value={newGroupData.voucher_150_percent}
                          onChange={(e) => setNewGroupData({ ...newGroupData, voucher_150_percent: e.target.value })}
                          className="px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                          step="0.01"
                        />
                        <input
                          type="number"
                          placeholder="200₪"
                          value={newGroupData.voucher_200_percent}
                          onChange={(e) => setNewGroupData({ ...newGroupData, voucher_200_percent: e.target.value })}
                          className="px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                          step="0.01"
                        />
                      </div>
                      
                      <div className="mt-2">
                        {(() => {
                          const sum = (parseFloat(newGroupData.voucher_50_percent) || 0) + 
                                     (parseFloat(newGroupData.voucher_100_percent) || 0) + 
                                     (parseFloat(newGroupData.voucher_150_percent) || 0) + 
                                     (parseFloat(newGroupData.voucher_200_percent) || 0)
                          const isValid = Math.abs(sum - 100) < 0.01
                          
                          return (
                            <>
                              <p className="text-xs">
                                סה"כ: <span className={`font-bold ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                                  {sum.toFixed(1)}%
                                </span>
                              </p>
                              {!isValid && (
                                <p className="text-xs text-red-600 mt-1 font-semibold">
                                  ⚠️ הסכום חייב להיות 100% בדיוק!
                                </p>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="pt-4 border-t">
                  {(() => {
                    const isCreatingNewGroup = !selectedGroup && newGroupData.name
                    const vouchersSum = isCreatingNewGroup 
                      ? (parseFloat(newGroupData.voucher_50_percent) || 0) + 
                        (parseFloat(newGroupData.voucher_100_percent) || 0) + 
                        (parseFloat(newGroupData.voucher_150_percent) || 0) + 
                        (parseFloat(newGroupData.voucher_200_percent) || 0)
                      : 100
                    const isVouchersValid = Math.abs(vouchersSum - 100) < 0.01
                    const canSubmit = !uploadExcelMutation.isPending && 
                                     (selectedGroup || newGroupData.name) && 
                                     (selectedInstitution || newInstitutionName) &&
                                     (!isCreatingNewGroup || isVouchersValid)
                    
                    return (
                      <>
                        {isCreatingNewGroup && !isVouchersValid && (
                          <div className="mb-3 p-3 bg-red-50 border-r-4 border-red-500 rounded">
                            <p className="text-sm text-red-800 font-semibold">
                              ⚠️ לא ניתן להעלות - אחוזי התלושים חייבים להסתכם ל-100% בדיוק
                            </p>
                            <p className="text-xs text-red-700 mt-1">
                              סכום נוכחי: {vouchersSum.toFixed(1)}%
                            </p>
                          </div>
                        )}
                        
                        <div className="flex gap-3 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setShowExcelModal(false)
                              setExcelData([])
                              setSelectedInstitution('')
                              setSelectedGroup('')
                              setNewInstitutionName('')
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                          >
                            ביטול
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
                            disabled={!canSubmit}
                          >
                            {uploadExcelMutation.isPending ? 'מעלה...' : `העלה ${excelData.length} עסקאות`}
                          </button>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* ============================================ */}
      {/* Modal בחירת טווח תאריכים */}
      {/* ============================================ */}
      {showExportSelectModal && exportType === 'dates' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">בחר טווח תאריכים</h2>
              <button
                onClick={() => {
                  setShowExportSelectModal(false)
                  setExportDateFrom('')
                  setExportDateTo('')
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              {/* מתאריך */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">מתאריך:</label>
                <input
                  type="date"
                  value={exportDateFrom}
                  onChange={(e) => setExportDateFrom(e.target.value)}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              {/* עד תאריך */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">עד תאריך:</label>
                <input
                  type="date"
                  value={exportDateTo}
                  onChange={(e) => setExportDateTo(e.target.value)}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              {/* תקופות מוכנות */}
              <div className="pt-4 border-t">
                <p className="text-sm font-semibold text-gray-700 mb-3">או בחר תקופה מוכנה:</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      const now = new Date()
                      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                      setExportDateFrom(firstDay.toISOString().split('T')[0])
                      setExportDateTo(now.toISOString().split('T')[0])
                    }}
                    className="px-3 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
                  >
                    החודש
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date()
                      const firstDay = new Date(now.getFullYear(), 0, 1)
                      setExportDateFrom(firstDay.toISOString().split('T')[0])
                      setExportDateTo(now.toISOString().split('T')[0])
                    }}
                    className="px-3 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
                  >
                    השנה
                  </button>
                  <button
                    onClick={() => {
                      setExportDateFrom('')
                      setExportDateTo('')
                    }}
                    className="px-3 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
                  >
                    כל התקופה
                  </button>
                </div>
              </div>
              
              {/* סטטיסטיקה */}
              {(() => {
                let filteredTransactions = transactions || []
                if (exportDateFrom) {
                  filteredTransactions = filteredTransactions.filter(t => 
                    new Date(t.transaction_time) >= new Date(exportDateFrom)
                  )
                }
                if (exportDateTo) {
                  filteredTransactions = filteredTransactions.filter(t => 
                    new Date(t.transaction_time) <= new Date(exportDateTo + 'T23:59:59')
                  )
                }
                
                return (
                  <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                    <p className="text-sm text-blue-900">
                      <span className="font-bold text-lg">{filteredTransactions.length}</span> עסקאות נמצאו
                    </p>
                  </div>
                )
              })()}
            </div>
            
            {/* כפתורים */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setShowExportSelectModal(false)
                  setShowExportModal(true)
                }}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-white font-semibold transition-colors flex items-center justify-center"
              >
                ⬅️ חזור
              </button>
              <button
                onClick={() => {
                  setShowExportSelectModal(false)
                  setShowExportMethodModal(true)
                }}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:shadow-lg font-semibold transition-all flex items-center justify-center"
              >
                📥 ייצא
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ============================================ */}
      {/* Modal בחירת קבוצות */}
      {/* ============================================ */}
      {showExportSelectModal && exportType === 'groups' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">בחר קבוצות לייצוא</h2>
              <button
                onClick={() => {
                  setShowExportSelectModal(false)
                  setSelectedExportGroups([])
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {/* חיפוש וסינון */}
              <div className="space-y-3 mb-4">
                <input
                  type="text"
                  placeholder="🔍 חיפוש קבוצה..."
                  className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                
                <select className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent">
                  <option value="">📋 כל המוסדות</option>
                  {institutions?.map((inst: any) => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>
              
              {/* בחר הכל / בטל הכל */}
              <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
                <input
                  type="checkbox"
                  checked={selectedExportGroups.length === groups?.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedExportGroups(groups?.map(g => g.id) || [])
                    } else {
                      setSelectedExportGroups([])
                    }
                  }}
                  className="w-5 h-5 text-green-600 rounded"
                />
                <span className="font-semibold text-gray-700">בחר הכל / בטל הכל</span>
              </div>
              
              {/* רשימת קבוצות מקובצות לפי מוסד */}
              <div className="space-y-4">
                {institutions?.map((inst: any) => {
                  const instGroups = groups?.filter(g => g.institution_id === inst.id) || []
                  if (instGroups.length === 0) return null
                  
                  return (
                    <div key={inst.id} className="border-2 border-gray-200 rounded-xl p-4">
                      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        📁 {inst.name}
                        <span className="text-sm text-gray-500 font-normal">({instGroups.length} קבוצות)</span>
                      </h3>
                      
                      <div className="space-y-2">
                        {instGroups.map((group: any) => {
                          const transactionCount = transactions?.filter(t => t.group_id === group.id).length || 0
                          const isSelected = selectedExportGroups.includes(group.id)
                          
                          return (
                            <label
                              key={group.id}
                              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                                isSelected ? 'bg-green-50 border-green-500' : 'border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedExportGroups([...selectedExportGroups, group.id])
                                  } else {
                                    setSelectedExportGroups(selectedExportGroups.filter(id => id !== group.id))
                                  }
                                }}
                                className="w-5 h-5 text-green-600 rounded"
                              />
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900">{group.name}</p>
                                <p className="text-sm text-gray-500">{transactionCount} עסקאות</p>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            
            {/* סטטיסטיקה ותחתית */}
            <div className="p-6 border-t bg-gray-50">
              <p className="text-sm text-gray-600 mb-4">
                נבחרו: <span className="font-bold text-green-600">{selectedExportGroups.length}</span> קבוצות, 
                <span className="font-bold text-blue-600 mr-1">
                  {transactions?.filter(t => selectedExportGroups.includes(t.group_id || '')).length || 0}
                </span> עסקאות
              </p>
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setShowExportSelectModal(false)
                    setShowExportModal(true)
                  }}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-white font-semibold transition-colors flex items-center justify-center"
                >
                  ⬅️ חזור
                </button>
                <button
                  onClick={() => {
                    if (selectedExportGroups.length === 0) {
                      toast.error('נא לבחור לפחות קבוצה אחת')
                      return
                    }
                    setShowExportSelectModal(false)
                    setShowExportMethodModal(true)
                  }}
                  disabled={selectedExportGroups.length === 0}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all flex items-center justify-center"
                >
                  📥 ייצא
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* ============================================ */}
      {/* Modal בחירת מוסדות/קבוצות/תאריכים */}
      {/* ============================================ */}
      {showExportSelectModal && exportType === 'institutions' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">בחר מוסדות לייצוא</h2>
              <button
                onClick={() => {
                  setShowExportSelectModal(false)
                  setSelectedExportInstitutions([])
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {/* חיפוש */}
              <input
                type="text"
                placeholder="🔍 חיפוש מוסד..."
                className="w-full px-4 py-3 border-2 rounded-xl mb-4 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              
              {/* בחר הכל / בטל הכל */}
              <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
                <input
                  type="checkbox"
                  checked={selectedExportInstitutions.length === institutions?.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedExportInstitutions(institutions?.map(i => i.id) || [])
                    } else {
                      setSelectedExportInstitutions([])
                    }
                  }}
                  className="w-5 h-5 text-green-600 rounded"
                />
                <span className="font-semibold text-gray-700">בחר הכל / בטל הכל</span>
              </div>
              
              {/* רשימת מוסדות */}
              <div className="space-y-2">
                {institutions?.map((inst: any) => {
                  const groupCount = groups?.filter(g => g.institution_id === inst.id).length || 0
                  const isSelected = selectedExportInstitutions.includes(inst.id)
                  
                  return (
                    <label
                      key={inst.id}
                      className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        isSelected ? 'bg-green-50 border-green-500' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedExportInstitutions([...selectedExportInstitutions, inst.id])
                          } else {
                            setSelectedExportInstitutions(selectedExportInstitutions.filter(id => id !== inst.id))
                          }
                        }}
                        className="w-5 h-5 text-green-600 rounded"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{inst.name}</p>
                        <p className="text-sm text-gray-500">{groupCount} קבוצות</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
            
            {/* סטטיסטיקה ותחתית */}
            <div className="p-6 border-t bg-gray-50">
              <p className="text-sm text-gray-600 mb-4">
                נבחרו: <span className="font-bold text-green-600">{selectedExportInstitutions.length}</span> מוסדות
              </p>
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setShowExportSelectModal(false)
                    setShowExportModal(true)
                  }}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-white font-semibold transition-colors flex items-center justify-center"
                >
                  ⬅️ חזור
                </button>
                <button
                  onClick={() => {
                    if (selectedExportInstitutions.length === 0) {
                      toast.error('נא לבחור לפחות מוסד אחד')
                      return
                    }
                    setShowExportSelectModal(false)
                    setShowExportMethodModal(true)
                  }}
                  disabled={selectedExportInstitutions.length === 0}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all flex items-center justify-center"
                >
                  📥 ייצא
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* ============================================ */}
      {/* Modal ייצוא Excel - בחירת סוג ייצוא */}
      {/* ============================================ */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">📤 ייצוא לקובץ Excel</h2>
              <button
                onClick={() => {
                  setShowExportModal(false)
                  setExportType('')
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <p className="text-gray-600 mb-6">בחר מה ברצונך לייצא:</p>
            
            <div className="space-y-3 mb-6">
              {/* הכל */}
              <label className="flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="exportType"
                  value="all"
                  checked={exportType === 'all'}
                  onChange={(e) => setExportType(e.target.value as any)}
                  className="w-5 h-5 text-green-600"
                />
                <div>
                  <p className="font-semibold text-gray-900">הכל (כל המערכת)</p>
                  <p className="text-sm text-gray-500">כל המוסדות, קבוצות ועסקאות</p>
                </div>
              </label>
              
              {/* מוסדות ספציפיים */}
              <label className="flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="exportType"
                  value="institutions"
                  checked={exportType === 'institutions'}
                  onChange={(e) => setExportType(e.target.value as any)}
                  className="w-5 h-5 text-green-600"
                />
                <div>
                  <p className="font-semibold text-gray-900">מוסדות ספציפיים</p>
                  <p className="text-sm text-gray-500">בחר מוסדות מתוך הרשימה</p>
                </div>
              </label>
              
              {/* קבוצות ספציפיות */}
              <label className="flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="exportType"
                  value="groups"
                  checked={exportType === 'groups'}
                  onChange={(e) => setExportType(e.target.value as any)}
                  className="w-5 h-5 text-green-600"
                />
                <div>
                  <p className="font-semibold text-gray-900">קבוצות ספציפיות</p>
                  <p className="text-sm text-gray-500">בחר קבוצות ישירות</p>
                </div>
              </label>
              
              {/* עסקאות לפי תאריכים */}
              <label className="flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="exportType"
                  value="dates"
                  checked={exportType === 'dates'}
                  onChange={(e) => setExportType(e.target.value as any)}
                  className="w-5 h-5 text-green-600"
                />
                <div>
                  <p className="font-semibold text-gray-900">עסקאות (טווח תאריכים)</p>
                  <p className="text-sm text-gray-500">סינון לפי תקופה</p>
                </div>
              </label>
            </div>
            
            {/* כפתורים */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setShowExportModal(false)
                  setExportType('')
                }}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors flex items-center justify-center"
              >
                ביטול
              </button>
              <button
                onClick={() => {
                  if (exportType === 'all') {
                    // ייצוא הכל - ישירות לבחירת שיטה
                    setShowExportModal(false)
                    setShowExportMethodModal(true)
                  } else if (exportType) {
                    // פתיחת modal בחירה
                    setShowExportModal(false)
                    setShowExportSelectModal(true)
                  }
                }}
                disabled={!exportType}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all flex items-center justify-center"
              >
                המשך ➡️
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ============================================ */}
      {/* Modal בחירת שיטת ייצוא - הורדה או מייל */}
      {/* ============================================ */}
      {showExportMethodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">איך תרצה לקבל את הקובץ?</h2>
              <button
                onClick={() => setShowExportMethodModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-3 mb-6">
              {/* הורד קובץ */}
              <button
                onClick={() => {
                  setShowExportMethodModal(false)
                  handleExportExcel()
                }}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-300 rounded-xl hover:bg-blue-50 hover:border-blue-500 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-right flex-1">
                  <p className="font-bold text-gray-900">הורד קובץ</p>
                  <p className="text-sm text-gray-500">שמור את הקובץ למחשב</p>
                </div>
              </button>
              
              {/* שלח במייל */}
              <button
                onClick={() => {
                  setShowExportMethodModal(false)
                  setShowEmailModal(true)
                }}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-300 rounded-xl hover:bg-green-50 hover:border-green-500 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-right flex-1">
                  <p className="font-bold text-gray-900">שלח במייל</p>
                  <p className="text-sm text-gray-500">קבל את הקובץ למייל שלך</p>
                </div>
              </button>
            </div>
            
            <button
              onClick={() => setShowExportMethodModal(false)}
              className="w-full px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
      
      {/* ============================================ */}
      {/* Modal Progress - ייצוא מתבצע */}
      {/* ============================================ */}
      {isExporting && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">📤 מכין קובץ לייצוא...</h2>
            
            <div className="space-y-4 mb-6">
              {/* Progress Bar */}
              <div className="relative">
                <div className="overflow-hidden h-4 text-xs flex rounded-full bg-gray-200">
                  <div
                    style={{ width: `${exportProgress}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-300"
                  ></div>
                </div>
                <p className="text-center mt-2 text-sm font-semibold text-gray-700">{exportProgress}%</p>
              </div>
              
              {/* Status Messages */}
              <div className="space-y-2">
                <div className={`flex items-center gap-2 ${exportProgress >= 10 ? 'text-green-600' : 'text-gray-400'}`}>
                  {exportProgress >= 10 ? '✅' : '⏹️'} שולף נתונים מהמערכת
                </div>
                <div className={`flex items-center gap-2 ${exportProgress >= 50 ? 'text-green-600' : 'text-gray-400'}`}>
                  {exportProgress >= 50 ? '✅' : '⏹️'} מכין גיליון סיכום
                </div>
                <div className={`flex items-center gap-2 ${exportProgress >= 70 ? 'text-green-600' : 'text-gray-400'}`}>
                  {exportProgress >= 70 ? '✅' : '⏹️'} מכין גיליון עסקאות
                </div>
                <div className={`flex items-center gap-2 ${exportProgress >= 90 ? 'text-green-600' : 'text-gray-400'}`}>
                  {exportProgress >= 90 ? '✅' : '⏹️'} מכין גיליון חובות
                </div>
              </div>
            </div>
            
            <div className="text-center text-sm text-gray-500">
              נא להמתין, התהליך עשוי לקחת מספר שניות...
            </div>
          </div>
        </div>
      )}
      
      {/* ============================================ */}
      {/* Modal שליחת מייל */}
      {/* ============================================ */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">📧 שליחת הקובץ במייל</h2>
              <button
                onClick={() => {
                  setShowEmailModal(false)
                  setExportEmail('')
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <p className="text-gray-600 mb-4">הזן את כתובת המייל לשליחת הקובץ:</p>
            
            <input
              type="email"
              value={exportEmail}
              onChange={(e) => setExportEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full px-4 py-3 border-2 rounded-xl mb-4 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              dir="ltr"
            />
            
            <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl mb-6">
              <p className="text-sm text-yellow-800">
                <span className="font-bold">💡 שים לב:</span> הקובץ יישלח תוך מספר דקות למייל שהזנת.
              </p>
            </div>
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setShowEmailModal(false)
                  setExportEmail('')
                }}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors flex items-center justify-center"
              >
                ביטול
              </button>
              <button
                onClick={() => {
                  if (!exportEmail || !exportEmail.includes('@')) {
                    toast.error('נא להזין כתובת מייל תקינה')
                    return
                  }
                  // TODO: לוגיקת שליחת מייל (יבוא בהמשך)
                  toast.success('הקובץ נשלח בהצלחה! בדוק את המייל שלך.')
                  setShowEmailModal(false)
                  setExportEmail('')
                }}
                disabled={!exportEmail}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all flex items-center justify-center"
              >
                שלח 📧
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// קומפוננטת עזר - תצוגת תלושים לעסקה
// ============================================

function TransactionVouchers({ transactionId }: { transactionId: string }) {
  const { data: vouchers, isLoading } = useQuery({
    queryKey: ['vouchers', transactionId],
    queryFn: () => getVouchersByTransaction(transactionId)
  })
  
  if (isLoading) {
    return <p className="text-sm text-gray-400">טוען תלושים...</p>
  }
  
  if (!vouchers || vouchers.length === 0) {
    return <p className="text-sm text-gray-400">אין תלושים</p>
  }
  
  return (
    <div className="flex flex-wrap gap-2">
      {vouchers.map((voucher) => (
        <VoucherTile key={voucher.id} voucher={voucher} />
      ))}
    </div>
  )
}

// ============================================
// דף קבוצה - רשימת עסקאות
// ============================================

function GroupPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [vouchersToPrint, setVouchersToPrint] = useState<Voucher[]>([])
  const [showPrintView, setShowPrintView] = useState(false)
  
  // פונקציה להדפסת תלושים של עסקה ספציפית
  const handlePrintTransactionVouchers = async (transactionId: string) => {
    const vouchers = await getVouchersByTransaction(transactionId)
    if (vouchers.length === 0) {
      toast.error('אין תלושים להדפסה')
      return
    }
    setVouchersToPrint(vouchers)
    setShowPrintView(true)
    
    // המתנה לרינדור ואז הדפסה
    setTimeout(() => {
      document.body.classList.add('printing')
      window.print()
      document.body.classList.remove('printing')
      setShowPrintView(false)
    }, 500)
  }
  
  const { data: group } = useQuery({
    queryKey: ['group', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('groups').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
    enabled: !!id
  })
  
  const { data: institution } = useQuery({
    queryKey: ['institution', group?.institution_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('institutions').select('*').eq('id', group.institution_id).single()
      if (error) throw error
      return data
    },
    enabled: !!group?.institution_id
  })
  
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions', 'group', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select('*').eq('group_id', id).order('transaction_time', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!id
  })
  
  const filteredTransactions = transactions?.filter(t => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      t.client_name?.toLowerCase().includes(search) ||
      t.client_phone?.includes(search) ||
      t.client_id_number?.includes(search) ||
      t.client_email?.toLowerCase().includes(search)
    )
  })
  
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
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between relative">
            {/* כפתורים - ימין */}
            <div className="flex items-center gap-3 z-10">
              {/* כפתור דף הבית */}
              <button 
                onClick={() => navigate('/')} 
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-blue-600 border-2 border-blue-200 rounded-xl shadow-sm hover:bg-blue-50 hover:border-blue-400 hover:shadow-md hover:scale-105 transition-all duration-200 font-semibold"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
                </svg>
                <span>דף הבית</span>
              </button>
              
              {/* כפתור חזרה למוסד */}
              <button 
                onClick={() => navigate(`/institution/${group?.institution_id}`)} 
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 border-2 border-indigo-300 rounded-xl shadow-md hover:from-indigo-100 hover:to-blue-100 hover:border-indigo-500 hover:shadow-lg hover:scale-105 transition-all duration-200 font-semibold"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
                <span>חזרה למוסד</span>
              </button>
            </div>
            
            {/* כותרת קבוצה ממורכזת - מינימליסטית */}
            <div className="absolute left-1/2 transform -translate-x-1/2 text-center">
              <h1 className="text-3xl font-bold text-gray-900 border-b-2 border-purple-500 pb-2 px-4">
                {group?.name}
              </h1>
              <p className="text-sm text-gray-500 mt-1">{institution?.name}</p>
            </div>
            
            {/* כפתור הדפסת תלושים - שמאל */}
            <button
              onClick={async () => {
                const { data: vouchers } = await supabase
                  .from('vouchers')
                  .select('*, transactions!inner(group_id)')
                  .eq('transactions.group_id', id)
                  .order('created_at', { ascending: false })
                
                if (!vouchers || vouchers.length === 0) {
                  toast.error('אין תלושים להדפסה בקבוצה זו')
                  return
                }
                
                setVouchersToPrint(vouchers)
                setShowPrintView(true)
                setTimeout(() => {
                  document.body.classList.add('printing')
                  window.print()
                  document.body.classList.remove('printing')
                  setShowPrintView(false)
                }, 500)
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl shadow-md hover:from-green-600 hover:to-green-700 hover:shadow-lg hover:scale-105 transition-all duration-200 font-semibold"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>הדפס תלושים</span>
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">מספר עסקאות</p>
            <p className="text-2xl font-bold text-gray-900">{transactions?.length || 0}</p>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">סה"כ תלושים נטו</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(group?.total_net_amount || 0)}
            </p>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">הסבסוד שלי</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(group?.total_my_subsidy || 0)}
            </p>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">סבסוד מוסד</p>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(group?.total_institution_subsidy || 0)}
            </p>
          </div>
        </div>
        
        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="חיפוש לפי שם, טלפון, ת״ז או מייל..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {/* Transactions List */}
        {filteredTransactions?.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500">אין עסקאות בקבוצה זו</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTransactions?.map((t: any) => (
              <div key={t.id} className="bg-white rounded-lg p-6 shadow-sm">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{t.client_name}</h3>
                    <p className="text-sm text-gray-500">{formatDate(t.transaction_time)}</p>
                  </div>
                  
                  <div className="text-left">
                    <p className="text-sm text-gray-500">סכום ששולם</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(t.amount_paid || 0)}</p>
                  </div>
                </div>
                
                {/* Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-b">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">הסבסוד שלי</p>
                    <p className="text-sm font-semibold text-green-600">{formatCurrency(t.my_subsidy_amount || 0)}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-500 mb-1">סבסוד המוסד</p>
                    <p className="text-sm font-semibold text-orange-600">{formatCurrency(t.institution_subsidy_amount || 0)}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-500 mb-1">סה"כ סבסוד</p>
                    <p className="text-sm font-semibold text-gray-600">{formatCurrency(t.total_subsidy || 0)}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-500 mb-1">תלוש נטו</p>
                    <p className="text-sm font-semibold text-blue-600">{formatCurrency(t.net_amount || 0)}</p>
                  </div>
                </div>
                
                {/* Vouchers */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-500">תלושים:</p>
                      <button
                        onClick={() => handlePrintTransactionVouchers(t.id)}
                        className="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1"
                      >
                        🖨️ הדפס
                      </button>
                    </div>
                    {t.has_unused_warning && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        ⚠️ {formatCurrency(t.unused_amount || 0)} לא מנוצל
                      </span>
                    )}
                  </div>
                  <TransactionVouchers transactionId={t.id} />
                </div>
                
                {/* Contact Info */}
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  {t.client_phone && (
                    <div className="flex items-center gap-1">
                      <span>📞</span>
                      <span>{t.client_phone}</span>
                    </div>
                  )}
                  {t.client_email && (
                    <div className="flex items-center gap-1">
                      <span>✉️</span>
                      <span>{t.client_email}</span>
                    </div>
                  )}
                  {t.client_id_number && (
                    <div className="flex items-center gap-1">
                      <span>🆔</span>
                      <span>{t.client_id_number}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      {/* תצוגת הדפסה */}
      {showPrintView && vouchersToPrint.length > 0 && (
        <div id="print-wrapper" className="fixed inset-0 bg-white z-50 overflow-auto">
          <VoucherPrintView vouchers={vouchersToPrint} />
        </div>
      )}
    </div>
  )
}

// ============================================
// דף מוסד - רשימת קבוצות
// ============================================

function InstitutionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<any>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [vouchersToPrint, setVouchersToPrint] = useState<Voucher[]>([])
  const [showPrintView, setShowPrintView] = useState(false)
  const [formData, setFormData] = useState<any>({
    name: '',
    nedarim_groupe_name: '',
    my_subsidy_percent: '',
    institution_subsidy_percent: '',
    voucher_50_percent: '',
    voucher_100_percent: '',
    voucher_150_percent: '',
    voucher_200_percent: '',
  })
  const queryClient = useQueryClient()
  
  const { data: institution } = useQuery({
    queryKey: ['institution', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('institutions').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
    enabled: !!id
  })
  
  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups', 'institution', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('groups').select('*').eq('institution_id', id).order('name')
      if (error) throw error
      return data
    },
    enabled: !!id
  })
  
  const { data: transactions } = useQuery({
    queryKey: ['transactions', 'institution', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select('*').eq('institution_id', id)
      if (error) throw error
      return data
    },
    enabled: !!id
  })
  
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: result, error } = await supabase.from('groups').insert({ ...data, institution_id: id }).select().single()
      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      toast.success('קבוצה נוצרה בהצלחה')
      setShowModal(false)
      resetForm()
    },
    onError: (error: any) => {
      if (error.message.includes('voucher_percentages_sum')) {
        toast.error('סכום אחוזי התלושים חייב להיות 100')
      } else {
        toast.error('שגיאה ביצירת קבוצה: ' + error.message)
      }
    }
  })
  
  // פונקציה להדפסת תלושים לפי קבוצות נבחרות
  const handlePrintSelectedGroups = async (groupIds: string[]) => {
    const { data: vouchers } = await supabase
      .from('vouchers')
      .select('*, transactions!inner(group_id)')
      .in('transactions.group_id', groupIds)
      .order('created_at', { ascending: false })
    
    if (!vouchers || vouchers.length === 0) {
      toast.error('אין תלושים להדפסה בקבוצות שנבחרו')
      return
    }
    
    setVouchersToPrint(vouchers)
    setShowPrintView(true)
    setTimeout(() => {
      document.body.classList.add('printing')
      window.print()
      document.body.classList.remove('printing')
      setShowPrintView(false)
    }, 500)
  }
  
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase.from('groups').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
      toast.success('קבוצה עודכנה בהצלחה. כל העסקאות חושבו מחדש.')
      setShowModal(false)
      setEditingGroup(null)
      resetForm()
    },
    onError: (error: any) => {
      if (error.message.includes('voucher_percentages_sum')) {
        toast.error('סכום אחוזי התלושים חייב להיות 100')
      } else {
        toast.error('שגיאה בעדכון קבוצה: ' + error.message)
      }
    }
  })
  
  const deleteMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from('groups').delete().eq('id', groupId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
      toast.success('קבוצה נמחקה בהצלחה')
    },
    onError: (error: any) => {
      toast.error('שגיאה במחיקת קבוצה: ' + error.message)
    }
  })
  
  const resetForm = () => {
    setFormData({
      name: '',
      nedarim_groupe_name: '',
      my_subsidy_percent: '',
      institution_subsidy_percent: '',
      voucher_50_percent: '',
      voucher_100_percent: '',
      voucher_150_percent: '',
      voucher_200_percent: '',
    })
  }
  
  const handleOpenAddModal = () => {
    setEditingGroup(null)
    resetForm()
    setShowModal(true)
  }
  
  const handleOpenEditModal = (group: any) => {
    setEditingGroup(group)
    setFormData({
      name: group.name,
      nedarim_groupe_name: group.nedarim_groupe_name,
      my_subsidy_percent: String(group.my_subsidy_percent),
      institution_subsidy_percent: String(group.institution_subsidy_percent),
      voucher_50_percent: String(group.voucher_50_percent),
      voucher_100_percent: String(group.voucher_100_percent),
      voucher_150_percent: String(group.voucher_150_percent),
      voucher_200_percent: String(group.voucher_200_percent),
    })
    setShowModal(true)
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // המרת מחרוזות למספרים
    const v50 = parseFloat(formData.voucher_50_percent) || 0
    const v100 = parseFloat(formData.voucher_100_percent) || 0
    const v150 = parseFloat(formData.voucher_150_percent) || 0
    const v200 = parseFloat(formData.voucher_200_percent) || 0
    const sum = v50 + v100 + v150 + v200
    
    if (Math.abs(sum - 100) > 0.01) {
      toast.error(`סכום אחוזי התלושים חייב להיות 100% (כרגע: ${sum.toFixed(1)}%)`)
      return
    }
    
    // המרת כל השדות למספרים לשמירה
    const dataToSave = {
      name: formData.name,
      nedarim_groupe_name: formData.nedarim_groupe_name,
      my_subsidy_percent: parseFloat(formData.my_subsidy_percent) || 0,
      institution_subsidy_percent: parseFloat(formData.institution_subsidy_percent) || 0,
      voucher_50_percent: v50,
      voucher_100_percent: v100,
      voucher_150_percent: v150,
      voucher_200_percent: v200,
    }
    
    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup.id, ...dataToSave })
    } else {
      createMutation.mutate(dataToSave)
    }
  }
  
  const handleDelete = (group: any) => {
    if (confirm(`האם אתה בטוח שברצונך למחוק את "${group.name}"? פעולה זו בלתי הפיכה!`)) {
      deleteMutation.mutate(group.id)
    }
  }
  
  const groupsWithStats = groups?.map(group => {
    const groupTransactions = transactions?.filter(t => t.group_id === group.id) || []
    const transactionCount = groupTransactions.length
    const mySubsidy = group.total_my_subsidy || 0
    const netAmount = group.total_net_amount || 0
    const debt = group.total_institution_subsidy || 0
    
    return { group, transactionCount, mySubsidy, netAmount, debt }
  }) || []
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between relative">
            {/* כפתור דף הבית - ימין */}
            <button 
              onClick={() => navigate('/')} 
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-blue-600 border-2 border-blue-200 rounded-xl shadow-sm hover:bg-blue-50 hover:border-blue-400 hover:shadow-md hover:scale-105 transition-all duration-200 font-semibold z-10"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
              </svg>
              <span>דף הבית</span>
            </button>
            
            {/* כותרת מוסד ממורכזת - מינימליסטית */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <h1 className="text-3xl font-bold text-gray-900 border-b-2 border-blue-500 pb-2 px-4">
                {institution?.name}
              </h1>
            </div>
            
            {/* כפתור הדפסת תלושים - שמאל */}
            <button
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl shadow-md hover:from-green-600 hover:to-green-700 hover:shadow-lg hover:scale-105 transition-all duration-200 font-semibold"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>הדפס תלושים</span>
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">קבוצות</h2>
        </div>
        
        {/* Groups Grid */}
        {groupsWithStats.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500 mb-4">אין קבוצות במוסד זה</p>
            <button
              onClick={handleOpenAddModal}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              הוסף קבוצה ראשונה
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupsWithStats.map(({ group, transactionCount, mySubsidy, netAmount, debt }) => (
              <div 
                key={group.id} 
                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-lg transition-shadow relative cursor-pointer"
                onClick={() => navigate(`/group/${group.id}`)}
              >
                {/* Menu */}
                <div className="absolute top-4 left-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const menu = e.currentTarget.nextElementSibling as HTMLElement
                      menu.classList.toggle('hidden')
                    }}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  
                  <div className="hidden absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border py-1 min-w-[120px] z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenEditModal(group)
                      }}
                      className="w-full px-4 py-2 text-right hover:bg-gray-50"
                    >
                      ✏️ עריכה
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(group)
                      }}
                      className="w-full px-4 py-2 text-right hover:bg-gray-50 text-red-600"
                    >
                      🗑️ מחיקה
                    </button>
                  </div>
                </div>
                
                <div className="pr-8">
                  <h4 className="text-lg font-semibold text-gray-900 mb-1">
                    {group.name}
                  </h4>
                  <p className="text-sm text-gray-500 mb-3">{transactionCount} עסקאות</p>
                  
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">שווי נטו</p>
                      <p className="text-sm font-semibold text-blue-600">{formatCurrency(netAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">הסבסוד שלי</p>
                      <p className="text-sm font-semibold text-green-600">{formatCurrency(mySubsidy)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">סבסוד מוסד</p>
                      <p className="text-sm font-semibold text-orange-600">{formatCurrency(debt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      {/* Floating Action Button */}
      <button
        onClick={handleOpenAddModal}
        className="fixed bottom-6 left-6 w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-full shadow-xl hover:shadow-2xl hover:scale-110 transition-all duration-300 flex items-center justify-center group"
      >
        <svg className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
        </svg>
      </button>
      
      {/* Group Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowModal(false)} />
          
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {editingGroup ? 'עריכת קבוצה' : 'הוספת קבוצה חדשה'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">שם הקבוצה</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">שם בנדרים</label>
                    <input
                      type="text"
                      value={formData.nedarim_groupe_name}
                      onChange={(e) => setFormData({ ...formData, nedarim_groupe_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                      disabled={!!editingGroup}
                    />
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">אחוזי סבסוד</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">הסבסוד שלי (%)</label>
                      <input
                        type="number"
                        value={formData.my_subsidy_percent}
                        onChange={(e) => setFormData({ ...formData, my_subsidy_percent: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">סבסוד המוסד (%)</label>
                      <input
                        type="number"
                        value={formData.institution_subsidy_percent}
                        onChange={(e) => setFormData({ ...formData, institution_subsidy_percent: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">
                    חלוקת תלושים (חייב להסתכם ל-100%)
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">תלושים של 50₪ (%)</label>
                      <input
                        type="number"
                        value={formData.voucher_50_percent}
                        onChange={(e) => setFormData({ ...formData, voucher_50_percent: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="50₪"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">תלושים של 100₪ (%)</label>
                      <input
                        type="number"
                        value={formData.voucher_100_percent}
                        onChange={(e) => setFormData({ ...formData, voucher_100_percent: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="100₪"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">תלושים של 150₪ (%)</label>
                      <input
                        type="number"
                        value={formData.voucher_150_percent}
                        onChange={(e) => setFormData({ ...formData, voucher_150_percent: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="150₪"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">תלושים של 200₪ (%)</label>
                      <input
                        type="number"
                        value={formData.voucher_200_percent}
                        onChange={(e) => setFormData({ ...formData, voucher_200_percent: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="200₪"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-2 text-sm">
                    {(() => {
                      const sum = (parseFloat(formData.voucher_50_percent) || 0) + 
                                 (parseFloat(formData.voucher_100_percent) || 0) + 
                                 (parseFloat(formData.voucher_150_percent) || 0) + 
                                 (parseFloat(formData.voucher_200_percent) || 0)
                      const isValid = Math.abs(sum - 100) < 0.01
                      
                      return (
                        <>
                          <p>
                            סה"כ: <span className={`font-bold ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                              {sum.toFixed(1)}%
                            </span>
                          </p>
                          {!isValid && (
                            <p className="text-xs text-red-600 mt-1 font-semibold">
                              ⚠️ הסכום חייב להיות 100% בדיוק!
                            </p>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  {(() => {
                    const sum = (parseFloat(formData.voucher_50_percent) || 0) + 
                               (parseFloat(formData.voucher_100_percent) || 0) + 
                               (parseFloat(formData.voucher_150_percent) || 0) + 
                               (parseFloat(formData.voucher_200_percent) || 0)
                    const isValid = Math.abs(sum - 100) < 0.01
                    const canSubmit = !createMutation.isPending && !updateMutation.isPending && isValid
                    
                    return (
                      <>
                        {!isValid && (
                          <div className="mb-3 p-3 bg-red-50 border-r-4 border-red-500 rounded">
                            <p className="text-sm text-red-800 font-semibold">
                              ⚠️ לא ניתן לשמור - אחוזי התלושים חייבים להסתכם ל-100% בדיוק
                            </p>
                            <p className="text-xs text-red-700 mt-1">
                              סכום נוכחי: {sum.toFixed(1)}%
                            </p>
                          </div>
                        )}
                        
                        <div className="flex gap-3 justify-end">
                          <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                          >
                            ביטול
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
                            disabled={!canSubmit}
                          >
                            {createMutation.isPending || updateMutation.isPending ? 'שומר...' : editingGroup ? 'עדכן' : 'צור קבוצה'}
                          </button>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* מודל בחירת קבוצות להדפסה */}
      {showPrintModal && groups && (
        <PrintVouchersModal
          institutionId={id!}
          groups={groups}
          onClose={() => setShowPrintModal(false)}
          onPrint={handlePrintSelectedGroups}
        />
      )}
      
      {/* תצוגת הדפסה */}
      {showPrintView && vouchersToPrint.length > 0 && (
        <div id="print-wrapper" className="fixed inset-0 bg-white z-50 overflow-auto">
          <VoucherPrintView vouchers={vouchersToPrint} />
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/institution/:id" element={<InstitutionPage />} />
          <Route path="/group/:id" element={<GroupPage />} />
          <Route path="/debt-management/*" element={<DebtManagementRoutes />} />
          <Route path="/sync-management" element={<SyncManagementPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" />
    </QueryClientProvider>
  )
}

export default App
