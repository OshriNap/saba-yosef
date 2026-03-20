import { useState } from 'react'
import type { MefarshimCategory } from '../lib/types'

const MEFARSHIM_OPTIONS: Record<string, string[]> = {
  pshat: ['Rashi', 'Ramban', 'Ibn Ezra', 'Sforno', 'Rashbam', 'Or HaChaim'],
  hasidic: ['Sefat Emet', 'Netivot Shalom', 'Mei HaShiloach', 'Kedushat Levi', 'Noam Elimelech'],
  bikoret: [],
}

export function Settings({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState<MefarshimCategory>('pshat')
  const [selected, setSelected] = useState<string[]>(MEFARSHIM_OPTIONS.pshat)

  const handleCategoryChange = (cat: MefarshimCategory) => {
    setCategory(cat)
    setSelected(MEFARSHIM_OPTIONS[cat] || [])
  }

  const toggleMefaresh = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    )
  }

  const handleSave = () => {
    localStorage.setItem('dvar-tora-settings', JSON.stringify({ category, selected }))
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">הגדרות</h2>
        <div className="mb-6">
          <label className="block font-bold mb-2">קטגוריית מפרשים ברירת מחדל</label>
          <select
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value as MefarshimCategory)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="pshat">פשט</option>
            <option value="hasidic">חסידות</option>
            <option value="bikoret">ביקורת המקרא</option>
            <option value="mixed">מעורב</option>
          </select>
        </div>
        <div className="mb-6">
          <label className="block font-bold mb-2">מפרשים נבחרים</label>
          <div className="space-y-2">
            {Object.values(MEFARSHIM_OPTIONS).flat().map((name) => (
              <label key={name} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(name)}
                  onChange={() => toggleMefaresh(name)}
                />
                {name}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">ביטול</button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg">שמור</button>
        </div>
      </div>
    </div>
  )
}
