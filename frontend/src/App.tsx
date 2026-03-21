import { useState } from 'react'
import { ConnectionDashboard } from './components/ConnectionDashboard'
import { StylePicker, type StylePrefs } from './components/StylePicker'
import { SuggestionCards } from './components/SuggestionCards'
import { MefarshimResearch } from './components/MefarshimResearch'
import { DvarToraEditor } from './components/Editor/DvarToraEditor'
import { Settings } from './components/Settings'
import type { WeeklyCollection, DvarTora, MefarshimResult } from './lib/types'

type View = 'dashboard' | 'style' | 'mefarshim' | 'suggestions' | 'editor'

export interface UserSelection {
  selectedNews: number[]
  selectedThemes: number[]
  customNews: string[]
  customThemes: string[]
  style?: StylePrefs
}

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [collection, setCollection] = useState<WeeklyCollection | null>(null)
  const [selection, setSelection] = useState<UserSelection | null>(null)
  const [dvarTora, setDvarTora] = useState<DvarTora | null>(null)
  const [mefarshimResults, setMefarshimResults] = useState<MefarshimResult[]>([])
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="fixed top-4 left-4 z-40">
        <button
          onClick={() => setShowSettings(true)}
          className="bg-white border rounded-full w-10 h-10 flex items-center justify-center shadow hover:shadow-md transition text-gray-600"
          title="הגדרות"
        >
          &#9881;
        </button>
      </div>

      {view === 'dashboard' && (
        <ConnectionDashboard onProceed={(c, sn, st, cn, ct) => {
          setCollection(c)
          setSelection({ selectedNews: sn, selectedThemes: st, customNews: cn, customThemes: ct })
          setView('style')
        }} />
      )}
      {view === 'style' && collection && selection && (
        <StylePicker
          onConfirm={(style) => {
            setSelection(prev => prev ? { ...prev, style } : null)
            setView('mefarshim')
          }}
          onBack={() => setView('dashboard')}
        />
      )}
      {view === 'mefarshim' && collection && selection && (
        <MefarshimResearch
          collection={collection}
          selection={selection}
          onComplete={(mefarshim) => {
            setMefarshimResults(mefarshim)
            setView('suggestions')
          }}
          onBack={() => setView('style')}
        />
      )}
      {view === 'suggestions' && collection && selection && (
        <SuggestionCards
          collection={collection}
          selection={selection}
          selectedMefarshim={mefarshimResults}
          onSelect={(dvar) => { setDvarTora(dvar); setView('editor') }}
          onBack={() => setView('mefarshim')}
        />
      )}
      {view === 'editor' && dvarTora && collection && (
        <DvarToraEditor
          dvarTora={dvarTora}
          collection={collection}
          onBack={() => setView('suggestions')}
        />
      )}

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  )
}
