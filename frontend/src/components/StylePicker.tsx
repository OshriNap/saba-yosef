import { useState } from 'react'

export interface StylePrefs {
  tone: string
  audience: string
  length: string
  approach: string
}

const TONES = [
  { value: 'רציני ואקדמי', label: 'רציני', desc: 'ניתוח מעמיק, שפה גבוהה' },
  { value: 'חם ואישי', label: 'חם ואישי', desc: 'סיפורים, חוויות, לב' },
  { value: 'מעורר השראה', label: 'מעורר השראה', desc: 'מוטיבציה, תקווה, אור' },
  { value: 'הומוריסטי וקליל', label: 'הומוריסטי', desc: 'קל, משעשע, עם חיוך' },
  { value: 'פרובוקטיבי', label: 'פרובוקטיבי', desc: 'מאתגר, שואל שאלות קשות' },
]

const AUDIENCES = [
  { value: 'ילדים (גילאי 6-12)', label: 'ילדים', desc: 'שפה פשוטה, סיפורים' },
  { value: 'נוער ובני ישיבה', label: 'נוער', desc: 'עומק בינוני, רלוונטי' },
  { value: 'קהל כללי בבית כנסת', label: 'קהל כללי', desc: 'נגיש, מגוון' },
  { value: 'תלמידי חכמים ולומדים', label: 'לומדים', desc: 'מקורות, עיון, חידוש' },
]

const LENGTHS = [
  { value: 'קצר מאוד — 2-3 דקות', label: '2-3 דק׳', desc: 'וורט קצר' },
  { value: 'בינוני — 5-7 דקות', label: '5-7 דק׳', desc: 'דבר תורה סטנדרטי' },
  { value: 'ארוך — 10-15 דקות', label: '10-15 דק׳', desc: 'דרשה מפורטת' },
]

const APPROACHES = [
  { value: 'אנליטי — ניתוח טקסטואלי של הפסוקים והמפרשים', label: 'אנליטי', desc: 'פירוש ומפרשים' },
  { value: 'סיפורי — דרך סיפור או משל', label: 'סיפורי', desc: 'מעשייה, משל, סיפור חסידי' },
  { value: 'דרשני — מוסר והשלכות מעשיות', label: 'דרשני', desc: 'מסר ומוסר השכל' },
  { value: 'אקטואלי — יוצא מהחדשות לתורה', label: 'אקטואלי', desc: 'פותח עם האקטואליה' },
  { value: 'פילוסופי — שאלות גדולות ומחשבה יהודית', label: 'פילוסופי', desc: 'מחשבת ישראל' },
]

function OptionGroup({ title, options, selected, onSelect }: {
  title: string
  options: { value: string; label: string; desc: string }[]
  selected: string
  onSelect: (value: string) => void
}) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold mb-3">{title}</h3>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className={`px-4 py-3 rounded-lg border transition text-right ${
              selected === opt.value
                ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400'
            }`}
          >
            <div className="font-bold text-sm">{opt.label}</div>
            <div className="text-xs mt-0.5 opacity-80">{opt.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export function StylePicker({ onConfirm, onBack }: {
  onConfirm: (style: StylePrefs) => void
  onBack: () => void
}) {
  const [tone, setTone] = useState('חם ואישי')
  const [audience, setAudience] = useState('קהל כללי בבית כנסת')
  const [length, setLength] = useState('בינוני — 5-7 דקות')
  const [approach, setApproach] = useState('דרשני — מוסר והשלכות מעשיות')

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button onClick={onBack} className="text-blue-600 mb-4 hover:underline">→ חזרה</button>
      <h2 className="text-3xl font-serif font-bold mb-2">סגנון דבר התורה</h2>
      <p className="text-gray-500 mb-8">בחר את הטון, הקהל, האורך והגישה — ההצעות יותאמו בהתאם</p>

      <OptionGroup title="טון" options={TONES} selected={tone} onSelect={setTone} />
      <OptionGroup title="קהל יעד" options={AUDIENCES} selected={audience} onSelect={setAudience} />
      <OptionGroup title="אורך" options={LENGTHS} selected={length} onSelect={setLength} />
      <OptionGroup title="גישה" options={APPROACHES} selected={approach} onSelect={setApproach} />

      <div className="text-center mt-8">
        <button
          onClick={() => onConfirm({ tone, audience, length, approach })}
          className="bg-amber-500 text-white px-8 py-3 rounded-lg text-lg font-bold hover:bg-amber-600 transition"
        >
          צור הצעות דבר תורה
        </button>
      </div>
    </div>
  )
}
