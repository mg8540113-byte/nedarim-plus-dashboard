// ============================================
// פונקציות עזר לניהול תלושים
// ============================================

import { supabase } from './supabase'
import type { Transaction, Voucher } from '../types'

/**
 * יצירת מזהה ייחודי לתלוש (11 תווים אלפאנומריים)
 * פורמט: אותיות גדולות + מספרים
 * דוגמה: "A3K9M2P7Q1X"
 */
export function generateVoucherId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  
  for (let i = 0; i < 11; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length)
    result += chars[randomIndex]
  }
  
  return result
}

/**
 * בדיקה שמזהה התלוש תקין (11 תווים אלפאנומריים)
 */
export function isValidVoucherId(voucherId: string): boolean {
  return /^[A-Z0-9]{11}$/.test(voucherId)
}

/**
 * יצירת תלושים פיזיים לעסקה
 * מקבל עסקה ויוצר שורה בטבלת vouchers לכל תלוש (50/100/150/200)
 * 
 * @param transaction - העסקה שעבורה ליצור תלושים
 * @returns מערך של התלושים שנוצרו
 */
export async function createVouchersForTransaction(
  transaction: Transaction
): Promise<Voucher[]> {
  const vouchersToCreate: Omit<Voucher, 'id' | 'created_at' | 'updated_at'>[] = []
  let sortOrder = 0
  
  // יצירת תלושים של 200₪
  for (let i = 0; i < transaction.vouchers_200; i++) {
    vouchersToCreate.push({
      transaction_id: transaction.id,
      amount: 200,
      voucher_code: generateVoucherId(),
      client_name: transaction.client_name,
      client_phone: transaction.client_phone,
      sort_order: sortOrder++
    })
  }
  
  // יצירת תלושים של 150₪
  for (let i = 0; i < transaction.vouchers_150; i++) {
    vouchersToCreate.push({
      transaction_id: transaction.id,
      amount: 150,
      voucher_code: generateVoucherId(),
      client_name: transaction.client_name,
      client_phone: transaction.client_phone,
      sort_order: sortOrder++
    })
  }
  
  // יצירת תלושים של 100₪
  for (let i = 0; i < transaction.vouchers_100; i++) {
    vouchersToCreate.push({
      transaction_id: transaction.id,
      amount: 100,
      voucher_code: generateVoucherId(),
      client_name: transaction.client_name,
      client_phone: transaction.client_phone,
      sort_order: sortOrder++
    })
  }
  
  // יצירת תלושים של 50₪
  for (let i = 0; i < transaction.vouchers_50; i++) {
    vouchersToCreate.push({
      transaction_id: transaction.id,
      amount: 50,
      voucher_code: generateVoucherId(),
      client_name: transaction.client_name,
      client_phone: transaction.client_phone,
      sort_order: sortOrder++
    })
  }
  
  // אם אין תלושים ליצור - החזר מערך ריק
  if (vouchersToCreate.length === 0) {
    return []
  }
  
  // שמירה ב-DB
  const { data, error } = await supabase
    .from('vouchers')
    .insert(vouchersToCreate)
    .select()
  
  if (error) {
    console.error('Error creating vouchers:', error)
    throw new Error(`Failed to create vouchers: ${error.message}`)
  }
  
  return data || []
}

/**
 * שליפת תלושים לפי עסקה
 * 
 * @param transactionId - מזהה העסקה
 * @returns מערך תלושים ממוינים לפי sort_order
 */
export async function getVouchersByTransaction(
  transactionId: string
): Promise<Voucher[]> {
  const { data, error } = await supabase
    .from('vouchers')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('sort_order', { ascending: true })
  
  if (error) {
    console.error('Error fetching vouchers:', error)
    return []
  }
  
  return data || []
}

/**
 * שליפת תלושים לפי קבוצה
 * 
 * @param groupId - מזהה הקבוצה
 * @returns מערך תלושים של כל העסקאות בקבוצה
 */
export async function getVouchersByGroup(
  groupId: string
): Promise<Voucher[]> {
  // שליפה דרך join עם transactions
  const { data, error } = await supabase
    .from('vouchers')
    .select(`
      *,
      transactions!inner(group_id)
    `)
    .eq('transactions.group_id', groupId)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching vouchers by group:', error)
    return []
  }
  
  return data || []
}

/**
 * שליפת תלושים לפי מוסד וקבוצות נבחרות
 * 
 * @param groupIds - מערך מזהי קבוצות
 * @returns מערך תלושים של כל העסקאות בקבוצות הנבחרות
 */
export async function getVouchersByGroups(
  groupIds: string[]
): Promise<Voucher[]> {
  if (groupIds.length === 0) return []
  
  const { data, error } = await supabase
    .from('vouchers')
    .select(`
      *,
      transactions!inner(group_id)
    `)
    .in('transactions.group_id', groupIds)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching vouchers by groups:', error)
    return []
  }
  
  return data || []
}
