import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { WeeklyCollection, FlowSection, RhetoricalMove } from '../lib/types'
import type { UserSelection } from '../App'

const MOVE_COLORS: Record<RhetoricalMove, { bg: string; text: string; border: string }> = {
  hook:     { bg: 'bg-amber-50',   text: 'text-amber-800',  border: 'border-amber-400' },
  build:    { bg: 'bg-blue-50',    text: 'text-blue-800',   border: 'border-blue-400' },
  surprise: { bg: 'bg-pink-50',    text: 'text-pink-800',   border: 'border-pink-400' },
  deepen:   { bg: 'bg-violet-50',  text: 'text-violet-800', border: 'border-violet-400' },
  resolve:  { bg: 'bg-slate-50',   text: 'text-slate-800',  border: 'border-slate-400' },
  land:     { bg: 'bg-green-50',   text: 'text-green-800',  border: 'border-green-400' },
}

const MOVE_LABELS: Record<RhetoricalMove, string> = {
  hook: 'hook', build: 'build', surprise: 'surprise',
  deepen: 'deepen', resolve: 'resolve', land: 'land',
}

interface FlowBuilderProps {
  collection: WeeklyCollection
  selection: UserSelection
  onComplete: (sections: FlowSection[]) => void
  onBack: () => void
}

export function FlowBuilder({ collection, selection, onComplete, onBack }: FlowBuilderProps) {
  const [sections, setSections] = useState<FlowSection[]>([])
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [loading, setLoading] = useState(false)
  const [refiningIndex, setRefiningIndex] = useState<number | null>(null)
  const [refiningGlobal, setRefiningGlobal] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [changes, setChanges] = useState('')
  const [refineInstruction, setRefineInstruction] = useState('')
  const [sectionInstruction, setSectionInstruction] = useState('')

  useEffect(() => {
    api.loadFlow(collection.id).then(flow => {
      if (flow.sections?.length) {
        setSections(flow.sections)
        setTotalMinutes(flow.total_minutes)
      }
    }).catch(() => {})
  }, [collection.id])

  const handleGenerate = async () => {
    setLoading(true)
    setSections([])
    setChanges('')
    await api.streamGenerateFlow(
      collection.id,
      {
        punchline: selection.punchline || '',
        rhetoric_sequence: (selection.rhetoricSequence || []).map(s => ({
          name: s.name, description: s.description, structure_template: s.structure_template,
        })),
        selected_news: selection.selectedNews,
        selected_themes: selection.selectedThemes,
        custom_news: selection.customNews,
        custom_themes: selection.customThemes,
      },
      (newSections, total) => {
        const withIds = newSections.map((s, i) => ({ ...s, id: s.id || crypto.randomUUID() }))
        setSections(withIds)
        setTotalMinutes(total)
        setExpandedIndex(0)
        setLoading(false)
      },
      () => {},
    )
  }

  const handleRefineSection = async (index: number) => {
    const instruction = sectionInstruction || 'שפר את השלב הזה'
    setRefiningIndex(index)
    await api.streamRefineSection(
      collection.id,
      {
        punchline: selection.punchline || '',
        sections,
        section_index: index,
        instruction,
      },
      (refined) => {
        setSections(prev => {
          const copy = [...prev]
          copy[index] = { ...refined, id: prev[index].id }
          return copy
        })
        setRefiningIndex(null)
        setSectionInstruction('')
      },
      () => {},
    )
  }

  const handleRefineGlobal = async () => {
    setRefiningGlobal(true)
    setChanges('')
    await api.streamRefineFlow(
      collection.id,
      {
        punchline: selection.punchline || '',
        sections,
        selected_news: selection.selectedNews,
        selected_themes: selection.selectedThemes,
        custom_news: selection.customNews,
        custom_themes: selection.customThemes,
        instruction: refineInstruction,
      },
      (newSections, total, changeNote) => {
        const withIds = newSections.map((s, i) => ({
          ...s,
          id: s.id || sections[i]?.id || crypto.randomUUID(),
        }))
        setSections(withIds)
        setTotalMinutes(total)
        setChanges(changeNote)
        setRefiningGlobal(false)
        setRefineInstruction('')
      },
      () => {},
    )
  }

  const handleSave = async () => {
    await api.saveFlow(collection.id, {
      punchline: selection.punchline || '',
      sections,
      total_minutes: totalMinutes,
    })
  }

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1
    if (newIdx < 0 || newIdx >= sections.length) return
    setSections(prev => {
      const copy = [...prev]
      ;[copy[index], copy[newIdx]] = [copy[newIdx], copy[index]]
      return copy
    })
    setExpandedIndex(newIdx)
  }

  const deleteSection = (index: number) => {
    setSections(prev => prev.filter((_, i) => i !== index))
    setExpandedIndex(null)
  }

  const addSection = () => {
    const newSection: FlowSection = {
      id: crypto.randomUUID(),
      title: 'שלב חדש',
      description: '',
      rhetoricalMove: 'build',
      assignedNews: [],
      assignedThemes: [],
      mefareshSlot: '',
      transitionTo: '',
      estimatedMinutes: 1,
    }
    setSections(prev => [...prev, newSection])
    setExpandedIndex(sections.length)
  }

  const updateSection = (index: number, updates: Partial<FlowSection>) => {
    setSections(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], ...updates }
      return copy
    })
  }

  const punchline = selection.punchline || ''

  return (
    <div className="max-w-4xl mx-auto p-6" dir="rtl">
      <button onClick={onBack} className="text-blue-600 mb-4 hover:underline">&rarr; חזרה</button>

      <div className="flex justify-between items-start mb-2">
        <div>
          <h2 className="text-3xl font-serif font-bold">מהלך הדרשה &mdash; {collection.parasha_name}</h2>
          <p className="text-gray-500 text-sm mt-1">פאנצ׳ליין: {punchline}</p>
        </div>
        <div className="flex gap-2">
          {sections.length > 0 && (
            <>
              <button
                onClick={handleRefineGlobal}
                disabled={refiningGlobal}
                className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm hover:bg-blue-200 transition disabled:opacity-50"
              >
                {refiningGlobal ? 'משכלל...' : '🔄 שכלל מהלך'}
              </button>
              <button onClick={addSection} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition">
                + הוסף שלב
              </button>
              <button onClick={handleSave} className="bg-gray-100 text-gray-500 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition">
                💾 שמור
              </button>
            </>
          )}
        </div>
      </div>

      {sections.length > 0 && !refiningGlobal && (
        <div className="mb-4">
          <input
            value={refineInstruction}
            onChange={e => setRefineInstruction(e.target.value)}
            placeholder="הנחיה לשכלול כללי (אופציונלי)..."
            className="w-full border rounded-lg p-2 text-sm text-gray-700"
            onKeyDown={e => e.key === 'Enter' && handleRefineGlobal()}
          />
        </div>
      )}

      {changes && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
          🔄 {changes}
        </div>
      )}

      {sections.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap text-xs">
          {sections.map((s, i) => {
            const colors = MOVE_COLORS[s.rhetoricalMove] || MOVE_COLORS.build
            return (
              <div key={s.id} className="flex items-center gap-2">
                <span className={`${colors.bg} ${colors.text} px-3 py-1 rounded-full font-medium`}>
                  {MOVE_LABELS[s.rhetoricalMove]}
                </span>
                {i < sections.length - 1 && <span className="text-gray-300">&rarr;</span>}
              </div>
            )
          })}
          <span className="text-gray-500 mr-4">≈ {totalMinutes} דקות</span>
        </div>
      )}

      {sections.length === 0 && !loading && (
        <div className="text-center py-16">
          <button
            onClick={handleGenerate}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700 transition"
          >
            Claude יבנה מהלך ראשוני
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-16 justify-center">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          <span className="text-amber-700 font-medium">Claude בונה מהלך... (זה לוקח דקה-שתיים)</span>
        </div>
      )}

      <div className="space-y-3">
        {sections.map((section, index) => {
          const colors = MOVE_COLORS[section.rhetoricalMove] || MOVE_COLORS.build
          const isExpanded = expandedIndex === index
          const isRefining = refiningIndex === index

          return (
            <div
              key={section.id}
              className={`bg-white border-2 rounded-xl relative transition ${
                isExpanded ? colors.border : 'border-gray-200'
              } ${isRefining ? 'opacity-60' : ''}`}
            >
              <div className={`absolute -top-2.5 right-4 ${colors.bg} ${colors.text} px-3 py-0.5 rounded-full text-xs font-semibold`}>
                {MOVE_LABELS[section.rhetoricalMove]} · {section.estimatedMinutes} דק׳
              </div>

              {!isExpanded && (
                <div
                  className="p-4 pt-5 cursor-pointer flex justify-between items-center"
                  onClick={() => setExpandedIndex(index)}
                >
                  <div>
                    <span className="font-semibold">{index + 1}. {section.title}</span>
                    <span className="text-gray-500 text-sm mr-3">
                      {section.assignedNews.length > 0 && `📰 ×${section.assignedNews.length} `}
                      {section.assignedThemes.length > 0 && `📖 ×${section.assignedThemes.length} `}
                      {section.mefareshSlot && '🔮 '}
                    </span>
                  </div>
                  <span className="text-gray-400 text-sm">לחץ לפתוח ←</span>
                </div>
              )}

              {isExpanded && (
                <div className="p-4 pt-5">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 space-y-3">
                      <input
                        value={section.title}
                        onChange={e => updateSection(index, { title: e.target.value })}
                        className="w-full text-lg font-bold border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none pb-1"
                      />
                      <textarea
                        value={section.description}
                        onChange={e => updateSection(index, { description: e.target.value })}
                        rows={3}
                        className="w-full text-gray-700 text-sm border rounded-lg p-2 focus:outline-none focus:border-blue-400"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">מהלך רטורי:</span>
                        <select
                          value={section.rhetoricalMove}
                          onChange={e => updateSection(index, { rhetoricalMove: e.target.value as RhetoricalMove })}
                          className="text-sm border rounded px-2 py-1"
                        >
                          <option value="hook">hook — תפיסת תשומת לב</option>
                          <option value="build">build — בניית רעיון</option>
                          <option value="surprise">surprise — הפתעה</option>
                          <option value="deepen">deepen — העמקה תורנית</option>
                          <option value="resolve">resolve — קשירת חוטים</option>
                          <option value="land">land — נחיתה</option>
                        </select>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {section.assignedNews.map(ni => {
                          const news = (collection.news_items || [])[ni]
                          return news ? (
                            <span key={`n${ni}`} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                              📰 {news.title?.slice(0, 40)}...
                            </span>
                          ) : null
                        })}
                        {section.assignedThemes.map(ti => {
                          const theme = (collection.parasha_themes || [])[ti]
                          return theme ? (
                            <span key={`t${ti}`} className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs">
                              📖 {theme.title}
                            </span>
                          ) : null
                        })}
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">מפרש/ציטוט:</span>
                        <input
                          value={section.mefareshSlot}
                          onChange={e => updateSection(index, { mefareshSlot: e.target.value })}
                          className="w-full text-sm text-violet-700 border-b border-transparent hover:border-gray-300 focus:border-violet-400 focus:outline-none italic"
                          placeholder="למשל: רש״י על פסוק X..."
                        />
                      </div>
                      {index < sections.length - 1 && (
                        <div className="border-t border-dashed border-gray-200 pt-2">
                          <span className="text-xs text-gray-500">מעבר לשלב הבא:</span>
                          <input
                            value={section.transitionTo}
                            onChange={e => updateSection(index, { transitionTo: e.target.value })}
                            className="w-full text-sm text-gray-500 border-b border-transparent hover:border-gray-300 focus:border-gray-400 focus:outline-none"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">זמן משוער:</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={section.estimatedMinutes}
                          onChange={e => {
                            const mins = parseInt(e.target.value) || 1
                            updateSection(index, { estimatedMinutes: mins })
                            setTotalMinutes(sections.reduce((sum, s, i) => sum + (i === index ? mins : s.estimatedMinutes), 0))
                          }}
                          className="w-16 text-sm border rounded px-2 py-1"
                        />
                        <span className="text-xs text-gray-400">דקות</span>
                      </div>
                      <div className="flex gap-2 items-center mt-2">
                        <input
                          value={sectionInstruction}
                          onChange={e => setSectionInstruction(e.target.value)}
                          placeholder="הנחיה לשכלול שלב זה..."
                          className="flex-1 text-sm border rounded-lg px-3 py-1.5"
                          onKeyDown={e => e.key === 'Enter' && handleRefineSection(index)}
                        />
                        <button
                          onClick={() => handleRefineSection(index)}
                          disabled={isRefining}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50"
                        >
                          {isRefining ? 'משכלל...' : '✨ שכלל'}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 mr-4 text-sm">
                      <button onClick={() => moveSection(index, 'up')} className="text-gray-400 hover:text-gray-700" disabled={index === 0}>⬆</button>
                      <button onClick={() => moveSection(index, 'down')} className="text-gray-400 hover:text-gray-700" disabled={index === sections.length - 1}>⬇</button>
                      <button onClick={() => deleteSection(index)} className="text-red-400 hover:text-red-600 mt-2">✕</button>
                      <button onClick={() => setExpandedIndex(null)} className="text-gray-400 hover:text-gray-700 mt-2">▲</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {sections.length > 0 && !loading && (
        <div className="flex justify-between items-center mt-8 border-t pt-4">
          <button onClick={handleGenerate} className="text-blue-600 hover:underline text-sm">
            נקה וצור מהלך חדש
          </button>
          <button
            onClick={() => onComplete(sections)}
            className="bg-green-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-green-700 transition"
          >
            המשך עם המהלך הזה
          </button>
        </div>
      )}
    </div>
  )
}
