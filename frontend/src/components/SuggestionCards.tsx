import { useEffect, useState, useRef } from 'react'
import { api } from '../lib/api'
import type { WeeklyCollection, DvarTora, DvarToraSuggestion, MefarshimResult } from '../lib/types'
import type { UserSelection } from '../App'

export function SuggestionCards({ collection, selection, selectedMefarshim, onSelect, onBack }: {
  collection: WeeklyCollection
  selection: UserSelection
  selectedMefarshim: MefarshimResult[]
  onSelect: (dvar: DvarTora) => void
  onBack: () => void
}) {
  const [suggestions, setSuggestions] = useState<DvarToraSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [thinking, setThinking] = useState(false)
  const [expanding, setExpanding] = useState<number | null>(null)
  const [expandText, setExpandText] = useState('')
  const [expandThinking, setExpandThinking] = useState(false)
  const streamRef = useRef<HTMLDivElement>(null)
  const expandRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getSuggestions(collection.id).then((s) => {
      if (s.length > 0) setSuggestions(s)
    })
  }, [collection.id])

  const handleGenerate = () => {
    setLoading(true)
    setThinking(true)
    setStreamText('')
    setSuggestions([])
    api.streamSuggestionsFocused(
      collection.id,
      {
        selectedNews: selection.selectedNews,
        selectedThemes: selection.selectedThemes,
        customNews: selection.customNews,
        customThemes: selection.customThemes,
        style: selection.style,
        mefarshimSummaries: selectedMefarshim.map(m => ({
          mefaresh: m.mefaresh,
          ref: m.ref,
          summary: m.summary,
        })),
        rhetoricSequence: selection.rhetoricSequence?.map(s => ({
          name: s.name,
          description: s.description,
          structure_template: s.structure_template,
        })),
        punchline: selection.punchline,
        beats: selection.beats,
      },
      (chunk) => {
        setThinking(false)
        setStreamText(prev => prev + chunk)
        if (streamRef.current) {
          streamRef.current.scrollTop = streamRef.current.scrollHeight
        }
      },
      (result) => {
        setSuggestions(result)
        setLoading(false)
        setThinking(false)
        setStreamText('')
      },
      () => { /* heartbeat */ },
    )
  }

  const handleSelect = (suggestion: DvarToraSuggestion) => {
    setExpanding(suggestion.id)
    setExpandThinking(true)
    setExpandText('')
    api.streamExpand(
      suggestion.id,
      (chunk) => {
        setExpandThinking(false)
        setExpandText(prev => prev + chunk)
        if (expandRef.current) {
          expandRef.current.scrollTop = expandRef.current.scrollHeight
        }
      },
      (dvar) => {
        setExpanding(null)
        setExpandThinking(false)
        setExpandText('')
        onSelect(dvar)
      },
      () => { /* heartbeat */ },
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button onClick={onBack} className="text-blue-600 mb-4 hover:underline">→ חזרה</button>
      <h2 className="text-3xl font-serif font-bold mb-6">הצעות לדבר תורה — {collection.parasha_name}</h2>

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

      {/* Streaming text for suggestions */}
      {loading && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-amber-700 font-medium">
              {thinking ? 'Claude חושב... (זה לוקח דקה-שתיים)' : 'Claude כותב...'}
            </span>
          </div>
          <div
            ref={streamRef}
            dir="rtl"
            className="bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed"
          >
            {thinking ? (
              <div className="flex items-center gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
                <span className="mr-3 text-green-600">מעבד פרשה, מפרשים וחדשות...</span>
              </div>
            ) : (
              <>{streamText}<span className="animate-pulse">▊</span></>
            )}
          </div>
        </div>
      )}

      {/* Streaming modal for expand */}
      {expanding !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-8">
          <div className="bg-gray-900 rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center gap-2 p-4 border-b border-gray-700">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-400 font-medium">
                {expandThinking ? 'Claude חושב... (זה לוקח דקה-שתיים)' : 'כותב דבר תורה מלא...'}
              </span>
            </div>
            <div
              ref={expandRef}
              dir="rtl"
              className="text-green-400 font-mono text-sm p-4 overflow-y-auto flex-1 whitespace-pre-wrap leading-relaxed"
            >
              {expandThinking ? (
                <div className="flex items-center gap-1 justify-center py-20">
                  <span className="animate-bounce text-2xl" style={{ animationDelay: '0ms' }}>●</span>
                  <span className="animate-bounce text-2xl" style={{ animationDelay: '150ms' }}>●</span>
                  <span className="animate-bounce text-2xl" style={{ animationDelay: '300ms' }}>●</span>
                </div>
              ) : (
                <>{expandText}<span className="animate-pulse">▊</span></>
              )}
            </div>
          </div>
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
              disabled={expanding !== null}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              בחר ופתח
            </button>
          </div>
        ))}
      </div>

      {suggestions.length > 0 && !loading && (
        <div className="text-center mt-6">
          <button onClick={handleGenerate} className="text-blue-600 hover:underline">
            נקה וצור הצעות חדשות
          </button>
        </div>
      )}
    </div>
  )
}
