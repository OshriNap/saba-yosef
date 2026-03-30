import { lazy, Suspense, startTransition, useState } from 'react'
import type { StylePrefs } from './components/StylePicker'
import type { WeeklyCollection, DvarTora, MefarshimResult, RhetoricStrategy, DrashaBeat, FlowSection } from './lib/types'

type View = 'dashboard' | 'rhetoric' | 'flow-builder' | 'style' | 'mefarshim' | 'suggestions' | 'editor'

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
  const [view, setView] = useState<View>('dashboard')
  const [collection, setCollection] = useState<WeeklyCollection | null>(null)
  const [selection, setSelection] = useState<UserSelection | null>(null)
  const [dvarTora, setDvarTora] = useState<DvarTora | null>(null)
  const [mefarshimResults, setMefarshimResults] = useState<MefarshimResult[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [flowSections, setFlowSections] = useState<FlowSection[]>([])

  const goToView = (nextView: View) => {
    startTransition(() => {
      setView(nextView)
    })
  }

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
          onComplete={(sections) => {
            setFlowSections(sections)
            goToView('style')
          }}
          onBack={() => goToView('rhetoric')}
        />
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
