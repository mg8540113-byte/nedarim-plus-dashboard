import { useState } from 'react'
import { Routes, Route, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'
import toast from 'react-hot-toast'
import { formatCurrency } from '../utils/calculations'

// ============================================
// דף סקירת חובות - רמה 1
// ============================================

function DebtOverviewPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  // שליפת כל המוסדות (כולל אלה ללא חוב)
  const { data: institutions } = useQuery({
    queryKey: ['institutions', 'all-for-debt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('institutions')
        .select('*')
        .order('total_debt', { ascending: false })
      if (error) throw error
      return data
    }
  })
  
  // שליפת כל התשלומים
  const { data: allPayments } = useQuery({
    queryKey: ['debt_payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debt_payments')
        .select('*')
        .order('payment_date', { ascending: false })
      if (error) throw error
      return data
    }
  })
  
  // חישוב סטטיסטיקות
  const totalActiveDebt = institutions?.reduce((sum, i) => sum + (i.total_debt || 0), 0) || 0
  const totalPaid = allPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
  
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
            
            {/* כותרת ממורכזת - מינימליסטית */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <h1 className="text-3xl font-bold text-gray-900 border-b-2 border-orange-500 pb-2 px-4">
                ניהול חוב מוסדות
              </h1>
            </div>
            
            {/* Spacer לאיזון */}
            <div className="w-[140px]"></div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <p className="text-sm text-gray-600 mb-2">סה״כ חובות פעילים</p>
            <p className="text-3xl font-bold text-red-600">
              {formatCurrency(totalActiveDebt)}
            </p>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <p className="text-sm text-gray-600 mb-2">סה״כ חובות ששולמו</p>
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(totalPaid)}
            </p>
          </div>
        </div>
        
        {/* Institution Cards */}
        {!institutions || institutions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500">אין מוסדות במערכת</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {institutions.map((inst: any) => {
              const instPayments = allPayments?.filter(p => p.institution_id === inst.id) || []
              const totalPaidForInst = instPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
              const totalDebtHistory = inst.total_institution_subsidy || 0
              
              return (
                <div
                  key={inst.id}
                  onClick={() => navigate(`/debt-management/${inst.id}`)}
                  className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden border-2 border-gray-100 hover:border-orange-300"
                >
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">{inst.name}</h3>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">חוב פעיל:</span>
                        <span className="font-bold text-red-600">
                          {formatCurrency(inst.total_debt || 0)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">היסטוריית חוב:</span>
                        <span className="font-bold text-orange-600">
                          {formatCurrency(totalDebtHistory)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center pb-3 border-b">
                        <span className="text-sm text-gray-600">שולם עד כה:</span>
                        <span className="font-bold text-green-600">
                          {formatCurrency(totalPaidForInst)}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-500 pt-2">
                        {instPayments.length} תשלומים
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 text-center font-semibold">
                    לחץ לניהול ←
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

// ============================================
// דף פרטי חוב מוסד - רמה 2
// ============================================

function InstitutionDebtPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  
  // שליפת פרטי מוסד
  const { data: institution } = useQuery({
    queryKey: ['institution', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id
  })
  
  // שליפת תשלומי המוסד
  const { data: payments } = useQuery({
    queryKey: ['debt_payments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debt_payments')
        .select('*')
        .eq('institution_id', id)
        .order('payment_date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!id
  })
  
  // Mutation להוספת תשלום
  const addPaymentMutation = useMutation({
    mutationFn: async ({ amount, notes }: { amount: number, notes: string }) => {
      const { data, error } = await supabase.from('debt_payments').insert({
        institution_id: id,
        amount,
        notes,
        payment_date: new Date().toISOString()
      }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
      queryClient.invalidateQueries({ queryKey: ['debt_payments'] })
      toast.success('תשלום נרשם בהצלחה')
      setPaymentAmount('')
      setPaymentNotes('')
    },
    onError: (error: any) => {
      toast.error('שגיאה ברישום תשלום: ' + error.message)
    }
  })
  
  const handleAddPayment = () => {
    const amount = parseFloat(paymentAmount)
    const currentDebt = institution?.total_debt || 0
    
    if (!amount || amount <= 0) {
      toast.error('נא להזין סכום תקין')
      return
    }
    
    if (amount > currentDebt) {
      toast.error(`הסכום עולה על החוב הנוכחי (${formatCurrency(currentDebt)})`)
      return
    }
    
    addPaymentMutation.mutate({ amount, notes: paymentNotes })
  }
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }
  
  const totalPaid = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
  
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
              
              {/* כפתור חזור */}
              <button 
                onClick={() => navigate('/debt-management')} 
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200 font-semibold"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                <span>חזרה לסקירה</span>
              </button>
            </div>
            
            {/* כותרת ממורכזת */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <h1 className="text-2xl font-bold text-gray-900 border-b-2 border-orange-500 pb-2 px-4">
                {institution?.name}
              </h1>
            </div>
            
            {/* Spacer */}
            <div className="w-[300px]"></div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <p className="text-sm text-gray-600 mb-2">חוב נוכחי</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(institution?.total_debt || 0)}
            </p>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <p className="text-sm text-gray-600 mb-2">שולם עד כה</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalPaid)}
            </p>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <p className="text-sm text-gray-600 mb-2">סה״כ חוב (מתמיד)</p>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(institution?.total_institution_subsidy || 0)}
            </p>
          </div>
        </div>
        
        {/* Payment History */}
        <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">💰 היסטוריית תשלומים</h2>
          
          {!payments || payments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">אין תשלומים עדיין</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תאריך</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סכום</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">הערות</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment: any) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(payment.payment_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                        {formatCurrency(payment.amount || 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {payment.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Add Payment Form */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-4">➕ רשום תשלום חדש</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">סכום (₪)</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder={`מקסימום: ${formatCurrency(institution?.total_debt || 0)}`}
                className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                step="0.01"
                min="0"
                max={institution?.total_debt || 0}
              />
              {paymentAmount && parseFloat(paymentAmount) > (institution?.total_debt || 0) && (
                <p className="text-xs text-red-600 mt-1">⚠️ הסכום עולה על החוב הנוכחי</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">הערות</label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="אופציונלי"
                className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={handleAddPayment}
                disabled={
                  addPaymentMutation.isPending || 
                  !paymentAmount || 
                  parseFloat(paymentAmount) <= 0 ||
                  parseFloat(paymentAmount) > (institution?.total_debt || 0)
                }
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all flex items-center justify-center"
              >
                {addPaymentMutation.isPending ? 'שומר...' : 'רשום תשלום'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// ============================================
// Router Component - ייצוא ראשי
// ============================================

export function DebtManagementRoutes() {
  return (
    <Routes>
      <Route index element={<DebtOverviewPage />} />
      <Route path=":id" element={<InstitutionDebtPage />} />
    </Routes>
  )
}
