import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { WeeklyCollection, RhetoricStrategy, DrashaBeat } from '../lib/types'

interface RhetoricPunchlineProps {
  collection: WeeklyCollection
  selection: {
    selectedNews: number[]
    selectedThemes: number[]
    customNews: string[]
    customThemes: string[]
  }
  onComplete: (rhetoric: RhetoricStrategy[], punchline: string, beats: DrashaBeat[]) => void
  onBack: () => void
}

export function RhetoricPunchline({ collection, selection, onComplete, onBack }: RhetoricPunchlineProps) {
  const [strategies, setStrategies] = useState<RhetoricStrategy[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [punchlines, setPunchlines] = useState<string[]>([])
  const [selectedPunchline, setSelectedPunchline] = useState('')
  const [customPunchline, setCustomPunchline] = useState('')
  const [beats, setBeats] = useState<DrashaBeat[]>([])
  const [loadingPunchlines, setLoadingPunchlines] = useState(false)
  const [loadingBeats, setLoadingBeats] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newStrategy, setNewStrategy] = useState({ name: '', description: '', structure_template: '' })
  const [expandedExample, setExpandedExample] = useState<number | null>(null)

  useEffect(() => {
    api.getRhetoricStrategies().then(setStrategies)
  }, [])

  const selectedStrategies = selectedIds.map(id => strategies.find(s => s.id === id)!).filter(Boolean)

  const toggleStrategy = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const moveStrategy = (id: number, direction: 'up' | 'down') => {
    setSelectedIds(prev => {
      const idx = prev.indexOf(id)
      if (idx < 0) return prev
      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const copy = [...prev]
      ;[copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]
      return copy
    })
  }

  const handleAddStrategy = async () => {
    if (!newStrategy.name) return
    const created = await api.createRhetoricStrategy(newStrategy)
    setStrategies(prev => [...prev, created])
    setNewStrategy({ name: '', description: '', structure_template: '' })
    setShowAddForm(false)
  }

  const handleGeneratePunchlines = async () => {
    setLoadingPunchlines(true)
    setPunchlines([])
    await api.streamPunchlines(
      collection.id,
      {
        selected_news: selection.selectedNews,
        selected_themes: selection.selectedThemes,
        custom_news: selection.customNews,
        custom_themes: selection.customThemes,
        rhetoric_sequence: selectedStrategies.map(s => ({
          name: s.name,
          description: s.description,
          structure_template: s.structure_template,
        })),
      },
      (result) => {
        setPunchlines(result)
        setLoadingPunchlines(false)
      },
      () => { /* heartbeat */ },
    )
  }

  const handleGenerateBeats = async () => {
    const punch = selectedPunchline || customPunchline
    if (!punch) return
    setLoadingBeats(true)
    setBeats([])
    await api.streamBeats(
      collection.id,
      {
        punchline: punch,
        selected_news: selection.selectedNews,
        selected_themes: selection.selectedThemes,
        custom_news: selection.customNews,
        custom_themes: selection.customThemes,
        rhetoric_sequence: selectedStrategies.map(s => ({
          name: s.name,
          description: s.description,
          structure_template: s.structure_template,
        })),
      },
      (result) => {
        setBeats(result)
        setLoadingBeats(false)
      },
      () => { /* heartbeat */ },
    )
  }

  const activePunchline = customPunchline || selectedPunchline

  const handleContinue = () => {
    onComplete(selectedStrategies, activePunchline, beats)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button onClick={onBack} className="text-blue-600 mb-4 hover:underline">&rarr; חזרה</button>
      <h2 className="text-3xl font-serif font-bold mb-2">רטוריקה ופאנצ&apos;ליין &mdash; {collection.parasha_name}</h2>
      <p className="text-gray-500 mb-6">בחר אסטרטגיות רטוריות וסדר אותן, ואז הגדר את הפאנצ&apos;ליין</p>

      {/* Section 1: Strategy Picker */}
      <h3 className="text-lg font-bold mb-3">אסטרטגיות רטוריות</h3>
      <div className="grid gap-3 mb-4">
        {strategies.map(s => (
          <div
            key={s.id}
            onClick={() => toggleStrategy(s.id)}
            className={`border rounded-lg p-4 cursor-pointer transition ${
              selectedIds.includes(s.id) ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold">{s.name}</h4>
                  {s.is_custom && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">מותאם אישית</span>}
                </div>
                <p className="text-gray-600 text-sm mt-1">{s.description}</p>
                <p className="text-gray-400 text-xs mt-1">מבנה: {s.structure_template}</p>
                {s.example && (
                  <div className="mt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedExample(expandedExample === s.id ? null : s.id) }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {expandedExample === s.id ? 'הסתר דוגמה' : 'הצג דוגמה'}
                    </button>
                    {expandedExample === s.id && (
                      <p className="mt-1 text-sm text-gray-700 bg-amber-50 p-2 rounded">{s.example}</p>
                    )}
                  </div>
                )}
              </div>
              {selectedIds.includes(s.id) && (
                <div className="flex flex-col gap-1 mr-3" onClick={e => e.stopPropagation()}>
                  <button onClick={() => moveStrategy(s.id, 'up')} className="text-gray-400 hover:text-gray-700 text-sm">&uarr;</button>
                  <span className="text-xs text-blue-600 font-bold text-center">{selectedIds.indexOf(s.id) + 1}</span>
                  <button onClick={() => moveStrategy(s.id, 'down')} className="text-gray-400 hover:text-gray-700 text-sm">&darr;</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="text-blue-600 text-sm hover:underline mb-4"
      >
        + הוסף אסטרטגיה
      </button>

      {showAddForm && (
        <div className="border rounded-lg p-4 mb-6 bg-gray-50">
          <input
            value={newStrategy.name}
            onChange={e => setNewStrategy(prev => ({ ...prev, name: e.target.value }))}
            placeholder="שם האסטרטגיה"
            className="w-full border rounded p-2 mb-2"
          />
          <input
            value={newStrategy.description}
            onChange={e => setNewStrategy(prev => ({ ...prev, description: e.target.value }))}
            placeholder="תיאור (1-2 משפטים)"
            className="w-full border rounded p-2 mb-2"
          />
          <input
            value={newStrategy.structure_template}
            onChange={e => setNewStrategy(prev => ({ ...prev, structure_template: e.target.value }))}
            placeholder="תבנית מבנה (למשל: פתח עם..., בנה דרך..., סיים ב...)"
            className="w-full border rounded p-2 mb-2"
          />
          <div className="flex gap-2">
            <button onClick={handleAddStrategy} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">שמור</button>
            <button onClick={() => setShowAddForm(false)} className="text-gray-500 px-4 py-2">ביטול</button>
          </div>
        </div>
      )}

      {/* Section 2: Punchline */}
      {selectedIds.length > 0 && (
        <>
          <h3 className="text-lg font-bold mb-3 mt-8">פאנצ&apos;ליין</h3>
          <p className="text-gray-500 text-sm mb-3">המסר המרכזי שהקהל ייקח מהדרשה</p>

          <div className="flex gap-3 mb-4">
            <button
              onClick={handleGeneratePunchlines}
              disabled={loadingPunchlines}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loadingPunchlines ? 'Claude חושב...' : 'צור פאנצ\'ליין'}
            </button>
          </div>

          {loadingPunchlines && (
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-amber-700 font-medium">Claude חושב על פאנצ&apos;ליינים...</span>
            </div>
          )}

          {punchlines.length > 0 && (
            <div className="grid gap-3 mb-4">
              {punchlines.map((p, i) => (
                <div
                  key={i}
                  onClick={() => { setSelectedPunchline(p); setCustomPunchline('') }}
                  className={`border rounded-lg p-4 cursor-pointer transition ${
                    selectedPunchline === p && !customPunchline
                      ? 'bg-green-50 border-green-400'
                      : 'bg-white border-gray-200 hover:border-green-300'
                  }`}
                >
                  <p className="text-gray-800">{p}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mb-6">
            <input
              value={customPunchline}
              onChange={e => { setCustomPunchline(e.target.value); setSelectedPunchline('') }}
              placeholder="או כתוב פאנצ'ליין משלך..."
              className="w-full border rounded-lg p-3 text-gray-800"
            />
          </div>

          {/* Optional Beats */}
          {activePunchline && (
            <>
              <h3 className="text-lg font-bold mb-3">ביטים (אופציונלי)</h3>
              <p className="text-gray-500 text-sm mb-3">נקודת ציון לכל שלב ברצף הרטורי</p>

              <button
                onClick={handleGenerateBeats}
                disabled={loadingBeats}
                className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition disabled:opacity-50 mb-4"
              >
                {loadingBeats ? 'Claude חושב...' : 'צור ביטים'}
              </button>

              {loadingBeats && (
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  <span className="text-amber-700 font-medium">Claude חושב על ביטים...</span>
                </div>
              )}

              {beats.length > 0 && (
                <div className="grid gap-3 mb-6">
                  {beats.map((b, i) => (
                    <div key={i} className="border rounded-lg p-4 bg-white">
                      <div className="text-sm text-blue-600 font-medium mb-1">{b.strategy_name}</div>
                      <input
                        value={b.beat}
                        onChange={e => {
                          const newBeats = [...beats]
                          newBeats[i] = { ...b, beat: e.target.value }
                          setBeats(newBeats)
                        }}
                        className="w-full border-b border-gray-200 p-1 text-gray-800 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Continue */}
          {activePunchline && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleContinue}
                className="bg-green-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-green-700 transition"
              >
                המשך
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
