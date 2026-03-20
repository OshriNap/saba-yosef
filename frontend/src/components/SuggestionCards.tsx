import { useEffect, useState, useRef } from 'react'
import { api } from '../lib/api'
import { MefarshimPicker } from './MefarshimPicker'
import type { WeeklyCollection, DvarTora, DvarToraSuggestion, MefarshimCategory } from '../lib/types'

const STEPS = [
  'מנתח את פרשת השבוע...',
  'סורק מפרשים רלוונטיים...',
  'מחפש קשרים עם האקטואליה...',
  'בונה הצעות לדבר תורה...',
  'מסיים ומסדר...',
]

function ProgressBar({ running }: { running: boolean }) {
  const [step, setStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    if (!running) {
      setStep(0)
      setProgress(0)
      return
    }
    setStep(0)
    setProgress(0)

    intervalRef.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + 0.5
        const newStep = Math.min(Math.floor(next / 20), STEPS.length - 1)
        setStep(newStep)
        return Math.min(next, 95) // Never reach 100 until actually done
      })
    }, 600)

    return () => clearInterval(intervalRef.current)
  }, [running])

  if (!running) return null

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="text-center mb-3 text-amber-700 font-medium">{STEPS[step]}</div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-l from-amber-400 to-amber-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-center mt-2 text-xs text-gray-400">זה לוקח בערך דקה-שתיים</div>
    </div>
  )
}

export function SuggestionCards({ collection, onSelect, onBack }: {
  collection: WeeklyCollection
  onSelect: (dvar: DvarTora) => void
  onBack: () => void
}) {
  const [suggestions, setSuggestions] = useState<DvarToraSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [expanding, setExpanding] = useState<number | null>(null)
  const [category, setCategory] = useState<MefarshimCategory>('pshat')

  useEffect(() => {
    api.getSuggestions(collection.id).then((s) => {
      if (s.length > 0) setSuggestions(s)
    })
  }, [collection.id])

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const result = await api.generateSuggestions(collection.id)
      setSuggestions(result)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = async (suggestion: DvarToraSuggestion) => {
    setExpanding(suggestion.id)
    try {
      const dvar = await api.expandSuggestion(suggestion.id)
      onSelect(dvar)
    } finally {
      setExpanding(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button onClick={onBack} className="text-blue-600 mb-4 hover:underline">→ חזרה</button>
      <h2 className="text-3xl font-serif font-bold mb-6">הצעות לדבר תורה — {collection.parasha_name}</h2>
      <MefarshimPicker selected={category} onChange={setCategory} />

      {suggestions.length === 0 && !loading && (
        <div className="text-center py-10">
          <button
            onClick={handleGenerate}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700 transition"
          >
            צור הצעות דבר תורה
          </button>
        </div>
      )}

      <ProgressBar running={loading} />

      <div className="grid gap-4 mt-6">
        {suggestions.map((s) => (
          <div key={s.id} className="border rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition">
            <h3 className="text-xl font-bold mb-2">{s.title}</h3>
            <p className="text-gray-700 font-medium mb-2">{s.thesis}</p>
            <p className="text-gray-500 text-sm mb-3">{s.outline}</p>
            <div className="flex gap-2 flex-wrap mb-3">
              {s.linked_news_themes.map((theme, i) => (
                <span key={i} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{theme}</span>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap mb-4">
              {s.sources.map((src, i) => (
                <span key={i} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">{src.mefaresh} — {src.ref}</span>
              ))}
            </div>
            {expanding === s.id ? (
              <div className="mt-2">
                <div className="text-sm text-amber-700 mb-2">כותב דבר תורה מלא...</div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-l from-green-400 to-green-600 animate-pulse" style={{ width: '70%' }} />
                </div>
                <div className="text-xs text-gray-400 mt-1">זה לוקח בערך דקה</div>
              </div>
            ) : (
              <button
                onClick={() => handleSelect(s)}
                disabled={expanding !== null}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                בחר ופתח
              </button>
            )}
          </div>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="text-center mt-6">
          <button onClick={handleGenerate} disabled={loading} className="text-blue-600 hover:underline">
            {loading ? 'מייצר...' : 'צור הצעות נוספות'}
          </button>
        </div>
      )}
    </div>
  )
}
