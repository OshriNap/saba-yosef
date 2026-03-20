import { useEffect, useState, useRef, useCallback } from 'react'
import { api } from '../lib/api'
import type { WeeklyCollection } from '../lib/types'

export function ConnectionDashboard({ onProceed }: {
  onProceed: (collection: WeeklyCollection, selectedNews: number[], selectedThemes: number[], customNews: string[], customThemes: string[]) => void
}) {
  const [collection, setCollection] = useState<WeeklyCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNews, setSelectedNews] = useState<Set<number>>(new Set())
  const [selectedThemes, setSelectedThemes] = useState<Set<number>>(new Set())
  const [customNews, setCustomNews] = useState<string[]>([])
  const [customThemes, setCustomThemes] = useState<string[]>([])
  const [newsInput, setNewsInput] = useState('')
  const [themeInput, setThemeInput] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const newsRefs = useRef<(HTMLDivElement | null)[]>([])
  const themeRefs = useRef<(HTMLDivElement | null)[]>([])
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number; strength: number; newsIdx: number; themeIdx: number; reason: string }[]>([])

  useEffect(() => {
    api.getCurrentWeek()
      .then(setCollection)
      .catch(() => setError('לא נמצאו נתונים לשבוע זה'))
      .finally(() => setLoading(false))
  }, [])

  const computeLines = useCallback(() => {
    if (!collection || !containerRef.current) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const newLines: typeof lines = []

    for (const conn of collection.connections) {
      const newsEl = newsRefs.current[conn.news_index]
      const themeEl = themeRefs.current[conn.theme_index]
      if (!newsEl || !themeEl) continue

      const newsRect = newsEl.getBoundingClientRect()
      const themeRect = themeEl.getBoundingClientRect()

      newLines.push({
        x1: newsRect.left - containerRect.left,
        y1: newsRect.top - containerRect.top + newsRect.height / 2,
        x2: themeRect.right - containerRect.left,
        y2: themeRect.top - containerRect.top + themeRect.height / 2,
        strength: conn.strength,
        newsIdx: conn.news_index,
        themeIdx: conn.theme_index,
        reason: conn.reason,
      })
    }
    setLines(newLines)
  }, [collection])

  useEffect(() => {
    if (!collection) return
    const timer = setTimeout(computeLines, 100)
    window.addEventListener('resize', computeLines)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', computeLines)
    }
  }, [collection, computeLines])

  const toggleNews = (idx: number) => {
    setSelectedNews(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const toggleTheme = (idx: number) => {
    setSelectedThemes(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const addCustomNews = () => {
    if (!newsInput.trim()) return
    setCustomNews(prev => [...prev, newsInput.trim()])
    setNewsInput('')
  }

  const addCustomTheme = () => {
    if (!themeInput.trim()) return
    setCustomThemes(prev => [...prev, themeInput.trim()])
    setThemeInput('')
  }

  const removeCustomNews = (idx: number) => {
    setCustomNews(prev => prev.filter((_, i) => i !== idx))
  }

  const removeCustomTheme = (idx: number) => {
    setCustomThemes(prev => prev.filter((_, i) => i !== idx))
  }

  const hasSelection = selectedNews.size > 0 || selectedThemes.size > 0 || customNews.length > 0 || customThemes.length > 0

  const isLineActive = (conn: { newsIdx: number; themeIdx: number }) => {
    if (!hasSelection) return true
    return selectedNews.has(conn.newsIdx) || selectedThemes.has(conn.themeIdx)
  }

  const isNewsHighlighted = (idx: number) => {
    if (!hasSelection) return true
    if (selectedNews.has(idx)) return true
    if (selectedThemes.size > 0 && collection) {
      return collection.connections.some(c => c.news_index === idx && selectedThemes.has(c.theme_index))
    }
    return false
  }

  const isThemeHighlighted = (idx: number) => {
    if (!hasSelection) return true
    if (selectedThemes.has(idx)) return true
    if (selectedNews.size > 0 && collection) {
      return collection.connections.some(c => c.theme_index === idx && selectedNews.has(c.news_index))
    }
    return false
  }

  if (loading) return <div className="text-center py-20 text-lg">טוען...</div>
  if (error) return <div className="text-center py-20 text-red-600">{error}</div>
  if (!collection) return null

  const news = collection.news_items.slice(0, 10)
  const themes = collection.parasha_themes || []

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-serif font-bold mb-2">{collection.parasha_name}</h1>
        <p className="text-gray-500">{collection.hebrew_date} | {collection.gregorian_date}</p>
      </header>

      <div ref={containerRef} className="relative flex gap-0 items-start" style={{ minHeight: '500px' }}>
        {/* Right: News */}
        <div className="flex-1 space-y-2 pl-16">
          <h2 className="text-xl font-bold text-blue-600 mb-3 text-center">חדשות השבוע</h2>
          {news.map((item, i) => (
            <div
              key={i}
              ref={el => { newsRefs.current[i] = el }}
              onClick={() => toggleNews(i)}
              className={`p-3 rounded-lg border-r-4 cursor-pointer transition-all duration-300 ${
                selectedNews.has(i)
                  ? 'bg-amber-50 border-amber-400 shadow-lg shadow-amber-100'
                  : isNewsHighlighted(i)
                    ? 'bg-white border-blue-400 hover:bg-blue-50'
                    : 'bg-gray-50 border-gray-200 opacity-40'
              }`}
            >
              <div className="font-bold text-sm">{selectedNews.has(i) ? '✓ ' : ''}{item.title}</div>
              {item.summary && <div className="text-xs text-gray-500 mt-1 line-clamp-1">{item.summary}</div>}
              {item.source && <div className="text-xs text-gray-300 mt-1">{item.source}</div>}
            </div>
          ))}

          {/* Custom news items */}
          {customNews.map((text, i) => (
            <div key={`custom-${i}`} className="p-3 rounded-lg border-r-4 border-green-400 bg-green-50 flex justify-between items-center">
              <div className="font-bold text-sm text-green-800">✓ {text}</div>
              <button onClick={() => removeCustomNews(i)} className="text-gray-400 hover:text-red-500 text-xs mr-2">✕</button>
            </div>
          ))}

          {/* Free text input */}
          <div className="flex gap-2 mt-3">
            <input
              value={newsInput}
              onChange={e => setNewsInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomNews()}
              placeholder="הוסף נושא אקטואלי..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white"
            />
            <button
              onClick={addCustomNews}
              disabled={!newsInput.trim()}
              className="bg-blue-500 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>

        {/* Middle: SVG Lines */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100%', height: '100%', zIndex: 10 }}
        >
          {lines.map((line, i) => {
            const active = isLineActive(line)
            const cx1 = line.x1 - 10
            const cx2 = line.x2 + 10
            const midX = (cx1 + cx2) / 2
            return (
              <path
                key={i}
                d={`M ${cx1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${cx2} ${line.y2}`}
                fill="none"
                stroke={active ? '#f59e0b' : '#d1d5db'}
                strokeWidth={active ? line.strength * 1.5 : 1}
                opacity={active ? 0.7 : 0.15}
                className="transition-all duration-500"
              />
            )
          })}
        </svg>

        {/* Left: Parasha Themes */}
        <div className="flex-1 space-y-2 pr-16">
          <h2 className="text-xl font-bold text-purple-600 mb-3 text-center">נושאי הפרשה והמועדים</h2>
          {themes.map((theme, i) => (
            <div
              key={i}
              ref={el => { themeRefs.current[i] = el }}
              onClick={() => toggleTheme(i)}
              className={`p-3 rounded-lg border-l-4 cursor-pointer transition-all duration-300 ${
                selectedThemes.has(i)
                  ? 'bg-amber-50 border-amber-400 shadow-lg shadow-amber-100'
                  : isThemeHighlighted(i)
                    ? `bg-white ${(theme as any).type === 'event' ? 'border-orange-400 hover:bg-orange-50' : 'border-purple-400 hover:bg-purple-50'}`
                    : 'bg-gray-50 border-gray-200 opacity-40'
              }`}
            >
              <div className="flex items-center gap-2">
                {(theme as any).type === 'event' && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">מועד</span>}
                <span className="font-bold text-sm">{selectedThemes.has(i) ? '✓ ' : ''}{theme.title}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{theme.description}</div>
            </div>
          ))}

          {/* Custom themes */}
          {customThemes.map((text, i) => (
            <div key={`custom-${i}`} className="p-3 rounded-lg border-l-4 border-green-400 bg-green-50 flex justify-between items-center">
              <div className="font-bold text-sm text-green-800">✓ {text}</div>
              <button onClick={() => removeCustomTheme(i)} className="text-gray-400 hover:text-red-500 text-xs ml-2">✕</button>
            </div>
          ))}

          {/* Free text input */}
          <div className="flex gap-2 mt-3">
            <input
              value={themeInput}
              onChange={e => setThemeInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomTheme()}
              placeholder="הוסף נושא תורני..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white"
            />
            <button
              onClick={addCustomTheme}
              disabled={!themeInput.trim()}
              className="bg-purple-500 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Connection reasons for selected */}
      {hasSelection && collection.connections.some(c => selectedNews.has(c.news_index) || selectedThemes.has(c.theme_index)) && (
        <div className="mt-4 text-center text-sm text-gray-500">
          {collection.connections
            .filter(c => selectedNews.has(c.news_index) || selectedThemes.has(c.theme_index))
            .slice(0, 3)
            .map((c, i) => (
              <span key={i} className="inline-block bg-amber-50 text-amber-800 px-3 py-1 rounded-full mx-1 mb-1">
                {c.reason}
              </span>
            ))}
        </div>
      )}

      {/* Bottom bar */}
      <div className="text-center mt-8">
        {hasSelection && (
          <p className="text-sm text-gray-500 mb-3">
            נבחרו {selectedNews.size + customNews.length} חדשות ← {selectedThemes.size + customThemes.length} נושאים
          </p>
        )}
        <button
          onClick={() => onProceed(collection, [...selectedNews], [...selectedThemes], customNews, customThemes)}
          disabled={!hasSelection}
          className="bg-amber-500 text-white px-8 py-3 rounded-lg text-lg font-bold hover:bg-amber-600 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          צור דבר תורה על הנבחרים
        </button>
      </div>
    </div>
  )
}
