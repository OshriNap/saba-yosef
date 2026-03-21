import type { MefarshimCategory } from '../lib/types'

const CATEGORIES: { value: MefarshimCategory; label: string; description: string }[] = [
  { value: 'pshat', label: 'פשט', description: 'רש״י, רמב״ן, אבן עזרא, כלי יקר, מלבי״ם, העמק דבר' },
  { value: 'hasidic', label: 'חסידות', description: 'שפת אמת, מי השילוח, קדושת לוי, נועם אלימלך, תולדות' },
  { value: 'mussar', label: 'מוסר', description: 'עקידת יצחק, של״ה, אלשיך, רבינו בחיי' },
  { value: 'midrash', label: 'מדרש', description: 'תנחומא, ויקרא רבה, ספרא, ילקוט שמעוני, זוהר' },
  { value: 'bikoret', label: 'ביקורת המקרא', description: 'שד״ל, דוד צבי הופמן, רג׳יו' },
]

export function MefarshimPicker({ selected, onChange }: {
  selected: MefarshimCategory[]
  onChange: (categories: MefarshimCategory[]) => void
}) {
  const toggle = (value: MefarshimCategory) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold mb-3">קטגוריות מפרשים</h3>
      <div className="flex gap-3 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => toggle(cat.value)}
            className={`px-4 py-2 rounded-lg border transition ${
              selected.includes(cat.value)
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
