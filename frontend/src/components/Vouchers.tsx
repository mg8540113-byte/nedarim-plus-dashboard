// ============================================
// קומפוננטות לניהול והדפסת תלושים
// ============================================

import { useEffect, useRef, useState } from 'react'
import type { Voucher } from '../types'

// JsBarcode מגיע מ-CDN (ב-index.html)
declare global {
  interface Window {
    JsBarcode: any
  }
}

// ============================================
// משבצת תלוש קטנה - תצוגה באתר
// ============================================

interface VoucherTileProps {
  voucher: Voucher
}

export function VoucherTile({ voucher }: VoucherTileProps) {
  return (
    <div className="inline-flex flex-col items-center bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 min-w-[100px]">
      {/* סכום התלוש */}
      <div className="text-2xl font-bold text-blue-900">
        ₪{voucher.amount}
      </div>

      {/* קו מפריד */}
      <div className="w-full h-px bg-blue-300 my-1"></div>

      {/* מזהה התלוש */}
      <div className="text-xs font-mono text-blue-600 text-center break-all">
        {voucher.voucher_code}
      </div>
    </div>
  )
}

// ============================================
// קומפוננטת ברקוד
// ============================================

interface BarcodeProps {
  value: string
  displayValue?: boolean
}

function Barcode({ value, displayValue = true }: BarcodeProps) {
  const barcodeRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (barcodeRef.current && window.JsBarcode) {
      try {
        window.JsBarcode(barcodeRef.current, value, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: displayValue,
          fontSize: 14,
          margin: 5
        })
      } catch (error) {
        console.error('Failed to generate barcode:', error)
      }
    }
  }, [value, displayValue])

  return <svg ref={barcodeRef}></svg>
}

// ============================================
// תצוגת הדפסה - 5 תלושים לדף A4
// עיצוב מותאם אישית עם תמונת רקע
// ============================================

interface VoucherPrintViewProps {
  vouchers: Voucher[]
}

export function VoucherPrintView({ vouchers }: VoucherPrintViewProps) {
  return (
    <div className="print-container" dir="rtl">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          
          body {
            margin: 0;
            padding: 0;
          }
          
          .print-container {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          
          .voucher-item {
            page-break-inside: avoid;
            page-break-after: auto;
            
            /* קריטי: מאלץ את הדפדפן להדפיס צבעים ורקעים */
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          .no-print {
            display: none !important;
          }
        }
        
        @media screen {
          .print-container {
            max-width: 775px;
            margin: 0 auto;
            background: white;
            padding: 20px;
          }
          
          .voucher-item {
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
        }
      `}</style>

      {vouchers.map((voucher) => (
        <div
          key={voucher.id}
          className="voucher-item"
          style={{
            width: '775px',
            height: '215px',
            backgroundImage: 'url(/voucher-bg.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            position: 'relative',
            fontFamily: "'Heebo', 'Rubik', 'Arial', sans-serif",
            color: '#333333',
            lineHeight: 1
          }}
        >
          {/* סכום */}
          <div style={{
            position: 'absolute',
            right: '116px',
            top: '70px',
            width: '200px',
            height: '55px',
            fontSize: '44px',
            fontWeight: 700,
            textAlign: 'right'
          }}>
            {voucher.amount} ₪
          </div>

          {/* שם לקוח */}
          <div style={{
            position: 'absolute',
            right: '64px',
            top: '135px',
            width: '250px',
            height: '25px',
            fontSize: '16px',
            fontWeight: 500,
            textAlign: 'right',
            whiteSpace: 'nowrap',
            overflow: 'hidden'
          }}>
            {voucher.client_name}
          </div>

          {/* טלפון */}
          <div style={{
            position: 'absolute',
            right: '80px',
            top: '168px',
            width: '150px',
            height: '20px',
            fontSize: '14px',
            fontWeight: 400,
            textAlign: 'right'
          }}>
            {voucher.client_phone || ''}
          </div>

          {/* ברקוד - קופסה ממורכזת */}
          <div style={{
            position: 'absolute',
            left: '63px',
            top: '88px',
            width: '142px',
            height: '63px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Barcode value={voucher.voucher_code} displayValue={false} />
          </div>

          {/* מספר מזהה (ID) */}
          <div style={{
            position: 'absolute',
            left: '66px',
            top: '155px',
            width: '135px',
            height: '20px',
            fontSize: '12px',
            fontFamily: 'monospace',
            textAlign: 'center'
          }}>
            {voucher.voucher_code}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================
// מודל לבחירת קבוצות להדפסה (דף מוסד)
// ============================================

interface PrintVouchersModalProps {
  institutionId: string
  groups: any[]
  onClose: () => void
  onPrint: (groupIds: string[]) => void
}

export function PrintVouchersModal({
  institutionId,
  groups,
  onClose,
  onPrint
}: PrintVouchersModalProps) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])

  const institutionGroups = groups.filter(g => g.institution_id === institutionId)

  const handleSelectAll = () => {
    if (selectedGroups.length === institutionGroups.length) {
      setSelectedGroups([])
    } else {
      setSelectedGroups(institutionGroups.map(g => g.id))
    }
  }

  const handlePrint = () => {
    if (selectedGroups.length === 0) {
      return
    }
    onPrint(selectedGroups)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-500 to-blue-600">
          <h2 className="text-xl font-bold text-white">🖨️ בחירת קבוצות להדפסה</h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {selectedGroups.length === institutionGroups.length ? '❌ בטל בחירת הכל' : '✅ בחר הכל'}
            </button>
            <p className="text-sm text-gray-600">
              נבחרו: <span className="font-bold text-blue-600">{selectedGroups.length}</span> מתוך {institutionGroups.length}
            </p>
          </div>

          <div className="space-y-2">
            {institutionGroups.map((group) => {
              const isSelected = selectedGroups.includes(group.id)

              return (
                <label
                  key={group.id}
                  className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {
                      if (isSelected) {
                        setSelectedGroups(selectedGroups.filter(id => id !== group.id))
                      } else {
                        setSelectedGroups([...selectedGroups, group.id])
                      }
                    }}
                    className="w-5 h-5 text-blue-600 rounded ml-3"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{group.name}</p>
                    <p className="text-sm text-gray-500">
                      {group.nedarim_groupe_name}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            ביטול
          </button>
          <button
            onClick={handlePrint}
            disabled={selectedGroups.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            🖨️ הדפס {selectedGroups.length > 0 && `(${selectedGroups.length} קבוצות)`}
          </button>
        </div>
      </div>
    </div>
  )
}
