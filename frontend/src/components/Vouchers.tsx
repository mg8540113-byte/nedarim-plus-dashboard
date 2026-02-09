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
// ============================================

interface VoucherPrintViewProps {
  vouchers: Voucher[]
}

export function VoucherPrintView({ vouchers }: VoucherPrintViewProps) {
  return (
    <div className="print-container">
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
            width: 210mm;
            height: 297mm;
            padding: 0;
            margin: 0;
          }
          
          .voucher-item {
            page-break-inside: avoid;
            page-break-after: auto;
            height: 59.4mm; /* 297mm / 5 = 59.4mm */
            width: 100%;
            box-sizing: border-box;
          }
          
          .no-print {
            display: none !important;
          }
        }
        
        @media screen {
          .print-container {
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            padding: 10mm;
          }
          
          .voucher-item {
            margin-bottom: 5mm;
          }
        }
      `}</style>
      
      {vouchers.map((voucher) => (
        <div key={voucher.id} className="voucher-item border-2 border-gray-300 flex flex-col">
          {/* כותרת עליונה - לוגו */}
          <div className="bg-[#F5F1E8] border-b-2 border-gray-300 py-3 text-center">
            <div className="text-2xl font-bold text-[#1e3a5f]" style={{ fontFamily: 'Arial, sans-serif' }}>
              🌸 חנות המתנות
            </div>
          </div>
          
          {/* כותרת משנית - תלוש זיכוי */}
          <div className="bg-[#1e3a5f] text-white py-2 text-center border-b-2 border-gray-300">
            <h2 className="text-xl font-bold">תלוש זיכוי</h2>
          </div>
          
          {/* סכום הזיכוי */}
          <div className="border-b-2 border-gray-300 py-3 px-6">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-700">סכום הזיכוי:</span>
              <div className="border-2 border-gray-400 px-6 py-1 min-w-[80px] text-center">
                <span className="text-2xl font-bold text-[#1e3a5f]">{voucher.amount} ₪</span>
              </div>
            </div>
          </div>
          
          {/* פרטי הלקוק */}
          <div className="border-b-2 border-gray-300 py-3 px-6">
            <div className="text-center mb-2">
              <span className="text-base font-semibold text-gray-700">── פרטי הלקוח ──</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">שם מלא:</span>
                <span className="font-medium text-gray-900 flex-1 text-left mr-4 border-b border-dotted border-gray-400">
                  {voucher.client_name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">מספר טלפון:</span>
                <span className="font-medium text-gray-900 flex-1 text-left mr-4 border-b border-dotted border-gray-400">
                  {voucher.client_phone || ''}
                </span>
              </div>
            </div>
          </div>
          
          {/* ברקוד + ID */}
          <div className="flex-1 flex flex-col items-center justify-center py-4 px-6">
            <Barcode value={voucher.voucher_code} displayValue={false} />
            <div className="text-center mt-2">
              <p className="text-xs font-mono text-gray-600 tracking-wider">
                {voucher.voucher_code}
              </p>
            </div>
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
                  className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected 
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
