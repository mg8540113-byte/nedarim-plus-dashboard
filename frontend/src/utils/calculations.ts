// ============================================
// לוגיקת חישובים - סבסוד ותלושים
// ============================================

export interface VoucherDistribution {
  vouchers_50: number
  vouchers_100: number
  vouchers_150: number
  vouchers_200: number
  unused_amount: number
}

export interface VoucherPercentages {
  voucher_50_percent: number
  voucher_100_percent: number
  voucher_150_percent: number
  voucher_200_percent: number
}

/**
 * חישוב חלוקת תלושים לפי אחוזים ויתרה
 * לוגיקה מתוקנת: חישוב לפי הסכום המקורי + השלמה רק מתלושים זמינים
 */
export function calculateVouchers(
  netAmount: number,
  percentages: VoucherPercentages
): VoucherDistribution {
  const originalAmount = netAmount
  let v50 = 0
  let v100 = 0
  let v150 = 0
  let v200 = 0
  
  // שלב 1: חישוב לפי אחוזים מהסכום המקורי
  if (percentages.voucher_200_percent > 0) {
    const amount = (originalAmount * percentages.voucher_200_percent) / 100
    v200 = Math.floor(amount / 200)
  }
  
  if (percentages.voucher_150_percent > 0) {
    const amount = (originalAmount * percentages.voucher_150_percent) / 100
    v150 = Math.floor(amount / 150)
  }
  
  if (percentages.voucher_100_percent > 0) {
    const amount = (originalAmount * percentages.voucher_100_percent) / 100
    v100 = Math.floor(amount / 100)
  }
  
  if (percentages.voucher_50_percent > 0) {
    const amount = (originalAmount * percentages.voucher_50_percent) / 100
    v50 = Math.floor(amount / 50)
  }
  
  // חישוב יתרה
  let remaining = originalAmount - (v200 * 200 + v150 * 150 + v100 * 100 + v50 * 50)
  
  // שלב 2: השלמת יתרה - רק מתלושים זמינים (אחוז > 0)
  if (percentages.voucher_200_percent > 0) {
    while (remaining >= 200) {
      v200++
      remaining -= 200
    }
  }
  
  if (percentages.voucher_150_percent > 0) {
    while (remaining >= 150) {
      v150++
      remaining -= 150
    }
  }
  
  if (percentages.voucher_100_percent > 0) {
    while (remaining >= 100) {
      v100++
      remaining -= 100
    }
  }
  
  if (percentages.voucher_50_percent > 0) {
    while (remaining >= 50) {
      v50++
      remaining -= 50
    }
  }
  
  return {
    vouchers_50: v50,
    vouchers_100: v100,
    vouchers_150: v150,
    vouchers_200: v200,
    unused_amount: Math.round(remaining * 100) / 100 // עיגול לשתי ספרות
  }
}

/**
 * פורמט רשימת תלושים לתצוגה
 * דוגמה: "3×200₪ + 6×100₪"
 */
export function formatVouchersList(vouchers: VoucherDistribution): string {
  const parts: string[] = []
  
  if (vouchers.vouchers_200 > 0) {
    parts.push(`${vouchers.vouchers_200}×200₪`)
  }
  if (vouchers.vouchers_150 > 0) {
    parts.push(`${vouchers.vouchers_150}×150₪`)
  }
  if (vouchers.vouchers_100 > 0) {
    parts.push(`${vouchers.vouchers_100}×100₪`)
  }
  if (vouchers.vouchers_50 > 0) {
    parts.push(`${vouchers.vouchers_50}×50₪`)
  }
  
  return parts.length > 0 ? parts.join(' + ') : 'אין תלושים'
}

/**
 * חישוב סבסוד
 */
export function calculateSubsidy(
  amountPaid: number,
  mySubsidyPercent: number,
  institutionSubsidyPercent: number
): {
  mySubsidy: number
  institutionSubsidy: number
  totalSubsidy: number
  netAmount: number
} {
  const mySubsidy = Math.round(amountPaid * mySubsidyPercent) / 100
  const institutionSubsidy = Math.round(amountPaid * institutionSubsidyPercent) / 100
  
  return {
    mySubsidy,
    institutionSubsidy,
    totalSubsidy: mySubsidy + institutionSubsidy,
    netAmount: amountPaid + mySubsidy + institutionSubsidy
  }
}

/**
 * בדיקה שאחוזי תלושים מסתכמים ל-100
 */
export function validateVoucherPercentages(percentages: VoucherPercentages): boolean {
  const sum = 
    percentages.voucher_50_percent +
    percentages.voucher_100_percent +
    percentages.voucher_150_percent +
    percentages.voucher_200_percent
  
  return Math.abs(sum - 100) < 0.01 // tolerance for floating point
}

/**
 * פורמט מספר למטבע ישראלי
 */
export function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * פורמט תאריך בפורמט ישראלי
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

/**
 * פורמט תאריך ושעה
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * יצירת transaction ID רנדומלי (11 תווים)
 */
export function generateTransactionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 11; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
