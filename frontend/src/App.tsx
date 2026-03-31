import { lazy, Suspense, startTransition, useState, useEffect, useCallback } from 'react'
import type { StylePrefs } from './components/StylePicker'
import type { WeeklyCollection, DvarTora, MefarshimResult, RhetoricStrategy, DrashaBeat, FlowSection } from './lib/types'
import type { FlowMefarshimMap } from './components/FlowBuilder'
import { api } from './lib/api'

type View = 'dashboard' | 'rhetoric' | 'flow-builder' | 'style' | 'mefarshim' | 'suggestions' | 'generating' | 'editor'

const STORAGE_KEY = 'dvar-tora-session'

interface SessionState {
  view: View
  collection: WeeklyCollection | null
  selection: UserSelection | null
  flowSections: FlowSection[]
  mefarshimResults: MefarshimResult[]
}

function loadSession(): Partial<SessionState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch { return {} }
}

function saveSession(state: SessionState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch { /* quota exceeded */ }
}

const ConnectionDashboard = lazy(async () => {
  const module = await import('./components/ConnectionDashboard')
  return { default: module.ConnectionDashboard }
})

const RhetoricPunchline = lazy(async () => {
  const module = await import('./components/RhetoricPunchline')
  return { default: module.RhetoricPunchline }
})

const StylePicker = lazy(async () => {
  const module = await import('./components/StylePicker')
  return { default: module.StylePicker }
})

const MefarshimResearch = lazy(async () => {
  const module = await import('./components/MefarshimResearch')
  return { default: module.MefarshimResearch }
})

const SuggestionCards = lazy(async () => {
  const module = await import('./components/SuggestionCards')
  return { default: module.SuggestionCards }
})

const DvarToraEditor = lazy(async () => {
  const module = await import('./components/Editor/DvarToraEditor')
  return { default: module.DvarToraEditor }
})

const FlowBuilder = lazy(async () => {
  const module = await import('./components/FlowBuilder')
  return { default: module.FlowBuilder }
})

const Settings = lazy(async () => {
  const module = await import('./components/Settings')
  return { default: module.Settings }
})

export interface UserSelection {
  selectedNews: number[]
  selectedThemes: number[]
  customNews: string[]
  customThemes: string[]
  style?: StylePrefs
  rhetoricSequence?: RhetoricStrategy[]
  punchline?: string
  beats?: DrashaBeat[]
}

export default function App() {
  const saved = loadSession()
  const [view, setView] = useState<View>(saved.view || 'dashboard')
  const [collection, setCollection] = useState<WeeklyCollection | null>(saved.collection || null)
  const [selection, setSelection] = useState<UserSelection | null>(saved.selection || null)
  const [dvarTora, setDvarTora] = useState<DvarTora | null>(null)
  const [mefarshimResults, setMefarshimResults] = useState<MefarshimResult[]>(saved.mefarshimResults || [])
  const [showSettings, setShowSettings] = useState(false)
  const [flowSections, setFlowSections] = useState<FlowSection[]>(saved.flowSections || [])
  const [flowMefarshim, setFlowMefarshim] = useState<FlowMefarshimMap>({})
  const [generatingText, setGeneratingText] = useState('')
  const [generatingThinking, setGeneratingThinking] = useState(false)

  // Persist session state on every change
  useEffect(() => {
    saveSession({ view, collection, selection, flowSections, mefarshimResults })
  }, [view, collection, selection, flowSections, mefarshimResults])

  const goToView = useCallback((nextView: View) => {
    startTransition(() => {
      setView(nextView)
    })
  }, [])

  const renderCurrentView = () => {
    if (view === 'dashboard') {
      return (
        <ConnectionDashboard onProceed={(c, sn, st, cn, ct) => {
          setCollection(c)
          setSelection({ selectedNews: sn, selectedThemes: st, customNews: cn, customThemes: ct })
          goToView('rhetoric')
        }} />
      )
    }

    if (view === 'rhetoric' && collection && selection) {
      return (
        <RhetoricPunchline
          collection={collection}
          selection={selection}
          onComplete={(rhetoric, punchline, beats) => {
            setSelection(prev => prev ? { ...prev, rhetoricSequence: rhetoric, punchline, beats } : null)
            goToView('style')
          }}
          onBuildFlow={(rhetoric, punchline) => {
            setSelection(prev => prev ? { ...prev, rhetoricSequence: rhetoric, punchline } : null)
            goToView('flow-builder')
          }}
          onBack={() => goToView('dashboard')}
        />
      )
    }

    if (view === 'flow-builder' && collection && selection) {
      return (
        <FlowBuilder
          collection={collection}
          selection={selection}
          onComplete={(sections, mefarshimMap) => {
            setFlowSections(sections)
            setFlowMefarshim(mefarshimMap)
            // Flow path: go directly to generating (skip style/mefarshim/suggestions)
            setGeneratingText('')
            setGeneratingThinking(true)
            goToView('generating')
            api.streamGenerateFromFlow(
              collection.id,
              {
                punchline: selection.punchline || '',
                sections,
                mefarshim_by_section: mefarshimMap,
                style: selection.style || null,
              },
              (chunk) => {
                setGeneratingThinking(false)
                setGeneratingText(prev => prev + chunk)
              },
              (dvar) => {
                setDvarTora(dvar)
                setGeneratingThinking(false)
                setGeneratingText('')
                goToView('editor')
              },
              () => {},
            )
          }}
          onBack={() => goToView('rhetoric')}
        />
      )
    }

    if (view === 'generating' && collection) {
      return (
        <div className="max-w-4xl mx-auto p-6" dir="rtl">
          <h2 className="text-3xl font-serif font-bold mb-4">כותב דרשה — {collection.parasha_name}</h2>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-700 font-medium">
              {generatingThinking ? 'Claude חושב... (זה לוקח דקה-שתיים)' : 'Claude כותב את הדרשה...'}
            </span>
          </div>
          <div
            dir="rtl"
            className="bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg max-h-[70vh] overflow-y-auto whitespace-pre-wrap leading-relaxed"
          >
            {generatingThinking ? (
              <div className="flex items-center gap-1 justify-center py-20">
                <span className="animate-bounce text-2xl" style={{ animationDelay: '0ms' }}>●</span>
                <span className="animate-bounce text-2xl" style={{ animationDelay: '150ms' }}>●</span>
                <span className="animate-bounce text-2xl" style={{ animationDelay: '300ms' }}>●</span>
              </div>
            ) : (
              <>{generatingText}<span className="animate-pulse">▊</span></>
            )}
          </div>
        </div>
      )
    }

    if (view === 'style' && collection && selection) {
      return (
        <StylePicker
          onConfirm={(style) => {
            setSelection(prev => prev ? { ...prev, style } : null)
            goToView('mefarshim')
          }}
          onBack={() => goToView('rhetoric')}
        />
      )
    }

    if (view === 'mefarshim' && collection && selection) {
      return (
        <MefarshimResearch
          collection={collection}
          selection={selection}
          onComplete={(mefarshim) => {
            setMefarshimResults(mefarshim)
            goToView('suggestions')
          }}
          onBack={() => goToView('style')}
        />
      )
    }

    if (view === 'suggestions' && collection && selection) {
      return (
        <SuggestionCards
          collection={collection}
          selection={selection}
          selectedMefarshim={mefarshimResults}
          onSelect={(dvar) => {
            setDvarTora(dvar)
            goToView('editor')
          }}
          onBack={() => goToView('mefarshim')}
        />
      )
    }

    if (view === 'editor' && dvarTora && collection) {
      return (
        <DvarToraEditor
          dvarTora={dvarTora}
          collection={collection}
          onBack={() => goToView('suggestions')}
        />
      )
    }

    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="fixed top-4 left-4 z-40">
        <button
          onClick={() => {
            startTransition(() => {
              setShowSettings(true)
            })
          }}
          className="bg-white border rounded-full w-10 h-10 flex items-center justify-center shadow hover:shadow-md transition text-gray-600"
          title="הגדרות"
        >
          &#9881;
        </button>
      </div>

      <Suspense fallback={<StageLoading />}>
        {renderCurrentView()}
        {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      </Suspense>
    </div>
  )
}

function StageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-4 text-center shadow-sm">
        <p className="text-sm font-medium text-gray-600">טוען את השלב הבא...</p>
      </div>
    </div>
  )
}
