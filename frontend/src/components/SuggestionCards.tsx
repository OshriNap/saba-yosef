import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { MefarshimPicker } from './MefarshimPicker'
import type { WeeklyCollection, DvarTora, DvarToraSuggestion, MefarshimCategory } from '../lib/types'

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
      {suggestions.length === 0 && (
        <div className="text-center py-10">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'מייצר הצעות...' : 'צור הצעות דבר תורה'}
          </button>
        </div>
      )}
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
            <button
              onClick={() => handleSelect(s)}
              disabled={expanding === s.id}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {expanding === s.id ? 'מרחיב...' : 'בחר ופתח'}
            </button>
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
