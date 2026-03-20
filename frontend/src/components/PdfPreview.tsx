import { useState } from 'react'
import { api } from '../lib/api'

export function PdfPreview({ dvarId, onClose }: { dvarId: number; onClose: () => void }) {
  const [layout, setLayout] = useState<'expanded' | 'compact'>('expanded')
  const pdfUrl = api.getPdfUrl(dvarId, layout)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[90vw] h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">תצוגה מקדימה — דף מקורות</h2>
          <div className="flex gap-3 items-center">
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value as 'expanded' | 'compact')}
              className="border rounded px-3 py-1"
            >
              <option value="expanded">מורחב</option>
              <option value="compact">מצומצם (דו-צדדי)</option>
            </select>
            <a href={pdfUrl} download className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm">
              הורד PDF
            </a>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl px-2">X</button>
          </div>
        </div>
        <iframe src={pdfUrl} className="flex-1 w-full" title="PDF Preview" />
      </div>
    </div>
  )
}
