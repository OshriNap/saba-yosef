import { useState } from 'react'
import type { MefarshimCategory } from '../lib/types'

const MEFARSHIM_OPTIONS: Record<string, { label: string; items: string[] }> = {
  pshat: {
    label: 'פשט',
    items: [
      'Rashi', 'Ramban', 'Ibn Ezra', 'Sforno', 'Rashbam', 'Or HaChaim',
      'Chizkuni', 'Rabbeinu Bahya', 'Bekhor Shor', "Da'at Zekenim",
      'Kli Yakar', 'Malbim', 'Rav Hirsch', 'Haamek Davar',
      'Abarbanel on Torah', 'HaKtav VeHaKabalah', 'Minchat Shai',
      'Ralbag on Torah', 'Siftei Chakhamim', 'Tur HaAroch',
      'Alshekh on Torah', 'Akeidat Yitzchak',
    ],
  },
  hasidic: {
    label: 'חסידות',
    items: [
      'Sefat Emet', 'Mei HaShiloach', 'Kedushat Levi',
      'Noam Elimelekh', 'Toldot Yaakov Yosef', 'Degel Machaneh Ephraim',
      'Maor VaShemesh', 'Ohev Yisrael', 'Tiferet Shlomo',
      'Bat Ayin', 'Likutei Moharan', 'Peri Tzadik',
      'Zera Kodesh', 'Ohr HaMeir', 'Yismach Moshe',
      'Ben Porat Yosef', 'Agra DeKala',
    ],
  },
  mussar: {
    label: 'מוסר',
    items: [
      'Akeidat Yitzchak', 'Shenei Luchot HaBerit', 'Alshekh on Torah',
      'Kav HaYashar', 'Reshit Chokhmah', 'Rabbeinu Bahya',
      'Recanati on the Torah',
    ],
  },
  midrash: {
    label: 'מדרש',
    items: [
      'Midrash Tanchuma', 'Midrash Tanchuma Buber', 'Vayikra Rabbah',
      'Shemot Rabbah', 'Bamidbar Rabbah', 'Midrash Aggadah',
      'Sifra', 'Yalkut Shimoni on Torah', 'Zohar',
    ],
  },
  bikoret: {
    label: 'ביקורת המקרא',
    items: [
      'Shadal', 'David Zvi Hoffmann', 'Reggio',
    ],
  },
}

export function Settings({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState<MefarshimCategory>('pshat')
  const [selected, setSelected] = useState<string[]>(MEFARSHIM_OPTIONS.pshat.items.slice(0, 6))

  const handleCategoryChange = (cat: MefarshimCategory) => {
    setCategory(cat)
    const opts = MEFARSHIM_OPTIONS[cat]
    if (opts) setSelected(opts.items.slice(0, 6))
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
      <div className="bg-white rounded-xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
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
            <option value="mussar">מוסר</option>
            <option value="midrash">מדרש</option>
            <option value="bikoret">ביקורת המקרא</option>
            <option value="mixed">מעורב</option>
          </select>
        </div>

        {Object.entries(MEFARSHIM_OPTIONS).map(([key, { label, items }]) => (
          <div key={key} className="mb-5">
            <h3 className="font-bold text-lg mb-2 border-b pb-1">{label}</h3>
            <div className="grid grid-cols-2 gap-1">
              {items.map((name) => (
                <label key={name} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={selected.includes(name)}
                    onChange={() => toggleMefaresh(name)}
                  />
                  <span className="text-sm">{name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="text-sm text-gray-500 mb-4">
          {selected.length} מפרשים נבחרו
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">ביטול</button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg">שמור</button>
        </div>
      </div>
    </div>
  )
}
