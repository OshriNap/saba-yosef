import type { MefarshimCategory } from '../lib/types'

const CATEGORIES: { value: MefarshimCategory; label: string; description: string }[] = [
  { value: 'pshat', label: 'פשט', description: 'רש״י, רמב״ן, אבן עזרא, ספורנו' },
  { value: 'hasidic', label: 'חסידות', description: 'שפת אמת, נתיבות שלום, מי השילוח' },
  { value: 'bikoret', label: 'ביקורת המקרא', description: 'פרשנות אקדמית וביקורתית' },
  { value: 'mixed', label: 'מעורב', description: 'בחירה חופשית של מפרשים' },
]

export function MefarshimPicker({ selected, onChange }: {
  selected: MefarshimCategory
  onChange: (category: MefarshimCategory) => void
}) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold mb-3">סגנון מפרשים</h3>
      <div className="flex gap-3 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => onChange(cat.value)}
            className={`px-4 py-2 rounded-lg border transition ${
              selected === cat.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
            }`}
          >
            <div className="font-bold">{cat.label}</div>
            <div className="text-xs mt-1 opacity-80">{cat.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
