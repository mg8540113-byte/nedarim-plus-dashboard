// ============================================
// ייבוא Excel - פענוח וולידציה
// ============================================

import * as XLSX from 'xlsx-js-style'
import { supabase } from './supabase'

// ============================================
// טיפוסים
// ============================================

export interface ParsedOrder {
    client_name: string
    client_id_number: string
    client_phone?: string
    client_email?: string
    net_amount: number
}

export interface ParsedPayment {
    client_id_number: string
    amount: number
    payment_date?: string
    notes?: string
}

export interface ValidationResult<T> {
    valid: boolean
    errors: string[]
    data: T[]
}

// ============================================
// פענוח קובץ Excel
// ============================================

export async function parseExcelFile(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = (e) => {
            try {
                const data = e.target?.result
                const workbook = XLSX.read(data, { type: 'binary' })
                const firstSheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[firstSheetName]

                // המרה ל-JSON עם headers
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                    header: 1,
                    defval: null
                })

                resolve(jsonData as any[])
            } catch (error) {
                reject(new Error('שגיאה בקריאת הקובץ: ' + (error as Error).message))
            }
        }

        reader.onerror = () => {
            reject(new Error('שגיאה בקריאת הקובץ'))
        }

        reader.readAsBinaryString(file)
    })
}

// ============================================
// וולידציה - הזמנות
// ============================================

export function validateOrdersData(rawData: any[]): ValidationResult<ParsedOrder> {
    const errors: string[] = []
    const validData: ParsedOrder[] = []

    if (!rawData || rawData.length < 2) {
        return {
            valid: false,
            errors: ['הקובץ ריק או לא מכיל שורות נתונים'],
            data: []
        }
    }

    // שורה 1 = כותרות, מתחילים מש מורה 2
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i]
        const rowNum = i + 1

        // דילוג על שורות ריקות
        if (!row || row.length === 0 || !row[0]) {
            continue
        }

        // שם לקוח (עמודה 0) - חובה
        const client_name = row[0]?.toString().trim()
        if (!client_name) {
            errors.push(`שורה ${rowNum}: שם לקוח חסר`)
            continue
        }

        // ת"ז (עמודה 1) - חובה
        const client_id_number = row[1]?.toString().trim()
        if (!client_id_number) {
            errors.push(`שורה ${rowNum}: ת"ז חסר`)
            continue
        }

        // בדיקת תקינות ת"ז (9 ספרות)
        if (!/^\d{9}$/.test(client_id_number)) {
            errors.push(`שורה ${rowNum}: ת"ז לא תקין (חייב להיות 9 ספרות)`)
            continue
        }

        // טלפון (עמודה 2) - אופציונלי
        const client_phone = row[2]?.toString().trim() || undefined

        // סכום (עמודה 3) - חובה
        const net_amount = parseFloat(row[3])
        if (isNaN(net_amount) || net_amount <= 0) {
            errors.push(`שורה ${rowNum}: סכום לא תקין (חייב להיות מספר חיובי)`)
            continue
        }

        // הכל תקני - הוסף לרשימה
        validData.push({
            client_name,
            client_id_number,
            client_phone,
            net_amount
        })
    }

    return {
        valid: errors.length === 0 && validData.length > 0,
        errors,
        data: validData
    }
}

// ============================================
// וולידציה - תשלומים
// ============================================

export async function validatePaymentsData(rawData: any[]): Promise<ValidationResult<ParsedPayment>> {
    const errors: string[] = []
    const validData: ParsedPayment[] = []

    if (!rawData || rawData.length < 2) {
        return {
            valid: false,
            errors: ['הקובץ ריק או לא מכיל שורות נתונים'],
            data: []
        }
    }

    // קבלת רשימת כל הת"ז הקיימים במערכת
    const { data: existingClients, error: clientsError } = await supabase
        .from('clients')
        .select('id_number')

    if (clientsError) {
        return {
            valid: false,
            errors: ['שגיאה בטעינת לקוחות מהמערכת'],
            data: []
        }
    }

    const existingIdNumbers = new Set(existingClients?.map(c => c.id_number) || [])

    // שורה 1 = כותרות, מתחילים משורה 2
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i]
        const rowNum = i + 1

        // דילוג על שורות ריקות
        if (!row || row.length === 0 || !row[0]) {
            continue
        }

        // ת"ז (עמודה 0) - חובה
        const client_id_number = row[0]?.toString().trim()
        if (!client_id_number) {
            errors.push(`שורה ${rowNum}: ת"ז חסר`)
            continue
        }

        // בדיקת תקינות ת"ז
        if (!/^\d{9}$/.test(client_id_number)) {
            errors.push(`שורה ${rowNum}: ת"ז לא תקין (חייב להיות 9 ספרות)`)
            continue
        }

        // בדיקה שהלקוח קיים במערכת
        if (!existingIdNumbers.has(client_id_number)) {
            errors.push(`שורה ${rowNum}: לקוח עם ת"ז ${client_id_number} לא נמצא במערכת`)
            continue
        }

        // סכום (עמודה 1) - חובה
        const amount = parseFloat(row[1])
        if (isNaN(amount) || amount <= 0) {
            errors.push(`שורה ${rowNum}: סכום לא תקין (חייב להיות מספר חיובי)`)
            continue
        }

        // תאריך (עמודה 2) - אופציונלי
        const payment_date = row[2]?.toString().trim() || undefined

        // הערות (עמודה 3) - אופציונלי
        const notes = row[3]?.toString().trim() || undefined

        // הכל תקני - הוסף לרשימה
        validData.push({
            client_id_number,
            amount,
            payment_date,
            notes
        })
    }

    return {
        valid: errors.length === 0 && validData.length > 0,
        errors,
        data: validData
    }
}

// ============================================
// ייבוא הזמנות ל-DB
// ============================================

export async function importOrders(
    orders: ParsedOrder[],
    groupId: string,
    institutionId: string
): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0
    let failed = 0
    const errors: string[] = []

    for (const order of orders) {
        try {
            // 1. יצירה/עדכון לקוח (ללא RPC - ישירות)
            let clientId: string

            // בדיקה אם הלקוח קיים
            const { data: existingClient } = await supabase
                .from('clients')
                .select('id')
                .eq('id_number', order.client_id_number)
                .maybeSingle()

            if (existingClient) {
                // לקוח קיים - עדכון
                const { error: updateError } = await supabase
                    .from('clients')
                    .update({
                        name: order.client_name,
                        phone: order.client_phone || null,
                        email: order.client_email || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingClient.id)

                if (updateError) {
                    errors.push(`${order.client_name}: שגיאה בעדכון לקוח - ${updateError.message}`)
                    failed++
                    continue
                }
                clientId = existingClient.id
            } else {
                // לקוח חדש - יצירה
                const { data: newClient, error: insertError } = await supabase
                    .from('clients')
                    .insert({
                        id_number: order.client_id_number,
                        name: order.client_name,
                        phone: order.client_phone || null,
                        email: order.client_email || null
                    })
                    .select('id')
                    .single()

                if (insertError || !newClient) {
                    errors.push(`${order.client_name}: שגיאה ביצירת לקוח - ${insertError?.message || 'לא הוחזר ID'}`)
                    failed++
                    continue
                }
                clientId = newClient.id
            }

            // 2. יצירת עסקה
            const { data: transactionData, error: transactionError } = await supabase
                .from('transactions')
                .insert({
                    client_id: clientId,
                    group_id: groupId,
                    institution_id: institutionId,
                    nedarim_transaction_id: `EXCEL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    source: 'excel',
                    client_name: order.client_name,
                    client_phone: order.client_phone,
                    client_id_number: order.client_id_number,
                    net_amount: order.net_amount,
                    amount_paid: 0,
                    transaction_time: new Date().toISOString(),
                    nedarim_groupe: 'Excel Import'
                })
                .select()
                .single()

            if (transactionError) {
                errors.push(`${order.client_name}: שגיאה ביצירת עסקה - ${transactionError.message}`)
                failed++
                continue
            }

            // 3. חישוב תלושים
            const { error: calcError } = await supabase
                .rpc('calculate_transaction_vouchers', {
                    transaction_id: transactionData.id
                })

            if (calcError) {
                errors.push(`${order.client_name}: שגיאה בחישוב תלושים - ${calcError.message}`)
                failed++
                continue
            }

            success++
        } catch (error) {
            errors.push(`${order.client_name}: ${(error as Error).message}`)
            failed++
        }
    }

    return { success, failed, errors }
}

// ============================================
// ייבוא תשלומים ל-DB
// ============================================

export async function importPayments(
    payments: ParsedPayment[]
): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0
    let failed = 0
    const errors: string[] = []

    for (const payment of payments) {
        try {
            // קבלת client_id לפי ת"ז
            const { data: clientData, error: clientError } = await supabase
                .from('clients')
                .select('id')
                .eq('id_number', payment.client_id_number)
                .single()

            if (clientError || !clientData) {
                errors.push(`ת"ז ${payment.client_id_number}: לקוח לא נמצא`)
                failed++
                continue
            }

            // יצירת רשומת תשלום
            const { error: paymentError } = await supabase
                .from('client_payments')
                .insert({
                    client_id: clientData.id,
                    amount: payment.amount,
                    payment_date: payment.payment_date || new Date().toISOString().split('T')[0],
                    notes: payment.notes
                })

            if (paymentError) {
                errors.push(`ת"ז ${payment.client_id_number}: ${paymentError.message}`)
                failed++
                continue
            }

            // ה-Trigger allocate_payment יופעל אוטומטית!
            success++
        } catch (error) {
            errors.push(`ת"ז ${payment.client_id_number}: ${(error as Error).message}`)
            failed++
        }
    }

    return { success, failed, errors }
}
