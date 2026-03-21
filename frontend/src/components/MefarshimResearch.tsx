import { useState } from 'react'
import { MefarshimPicker } from './MefarshimPicker'
import { api } from '../lib/api'
import type { WeeklyCollection, MefarshimCategory, MefarshimResult } from '../lib/types'

interface MefarshimResearchProps {
  collection: WeeklyCollection
  selection: {
    selectedNews: number[]
    selectedThemes: number[]
    customNews: string[]
    customThemes: string[]
  }
  onComplete: (mefarshim: MefarshimResult[]) => void
  onBack: () => void
}

export function MefarshimResearch({ collection, selection, onComplete, onBack }: MefarshimResearchProps) {
  const [categories, setCategories] = useState<MefarshimCategory[]>(['pshat'])
  const [results, setResults] = useState<MefarshimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const handleSearch = async () => {
    setLoading(true)
    setResults([])
    setPhase(null)
    await api.streamMefarshimResearch(
      collection.id,
      {
        selected_news: selection.selectedNews,
        selected_themes: selection.selectedThemes,
        custom_news: selection.customNews,
        custom_themes: selection.customThemes,
        categories,
      },
      (result) => {
        setResults(prev => [...prev, result])
      },
      (_phase, _count) => {
        setPhase(`מחפש ${_count} מפרשים נוספים...`)
      },
      () => {
        setLoading(false)
        setPhase(null)
      },
    )
  }

  const toggleSelected = (idx: number) => {
    setResults(prev => prev.map((r, i) =>
      i === idx ? { ...r, selected: !r.selected } : r
    ))
  }

  const handleContinue = () => {
    onComplete(results.filter(r => r.selected))
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button onClick={onBack} className="text-blue-600 mb-4 hover:underline">
        &rarr; חזרה
      </button>
      <h2 className="text-3xl font-serif font-bold mb-2">
        מחקר מפרשים &mdash; {collection.parasha_name}
      </h2>
      <p className="text-gray-500 mb-6">
        בחר קטגוריות מפרשים וקלוד ימצא את הפירושים הרלוונטיים לנושאים שבחרת
      </p>

      <MefarshimPicker selected={categories} onChange={setCategories} />

      {results.length === 0 && !loading && (
        <div className="text-center py-10">
          <button
            onClick={handleSearch}
            disabled={categories.length === 0}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            חפש מפרשים
          </button>
        </div>
      )}

      {loading && results.length === 0 && (
        <div className="mt-6 text-center py-10">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-amber-700 font-medium">
              מחפש ומסכם מפרשים...
            </span>
          </div>
        </div>
      )}

      {phase && (
        <div className="mt-4 flex items-center gap-2 justify-center">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-blue-700 font-medium">{phase}</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid gap-4 mt-6">
          {results.map((r, idx) => (
            <div
              key={idx}
              className={`border rounded-lg p-5 bg-white shadow-sm transition ${
                r.selected ? 'border-blue-300' : 'border-gray-200 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={r.selected}
                  onChange={() => toggleSelected(idx)}
                  className="mt-1.5 w-4 h-4 accent-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-lg">{r.mefaresh}</h4>
                    <span className="text-gray-400 text-sm">{r.ref}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.source === 'db'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {r.source === 'db' ? 'מהמאגר' : 'חדש'}
                    </span>
                  </div>
                  <p className="text-gray-700 leading-relaxed">{r.summary}</p>
                  {r.original_text && (
                    <div className="mt-2">
                      <button
                        onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {expandedIdx === idx ? 'הסתר מקור' : 'הצג מקור'}
                      </button>
                      {expandedIdx === idx && (
                        <div className="mt-2 p-3 bg-amber-50 rounded text-sm text-gray-800 leading-relaxed max-h-40 overflow-y-auto">
                          {r.original_text}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && !loading && (
        <div className="mt-6 flex items-center justify-between">
          <span className="text-gray-500 text-sm">
            {results.filter(r => r.selected).length} מתוך {results.length} מפרשים נבחרו
          </span>
          <div className="flex gap-3">
            <button
              onClick={handleSearch}
              className="text-blue-600 hover:underline"
            >
              חפש מחדש
            </button>
            <button
              onClick={handleContinue}
              disabled={results.filter(r => r.selected).length === 0}
              className="bg-green-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              המשך להצעות
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
