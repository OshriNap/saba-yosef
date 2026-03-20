import { useState } from 'react'
import { WeeklyDashboard } from './components/WeeklyDashboard'
import { SuggestionCards } from './components/SuggestionCards'
import { DvarToraEditor } from './components/Editor/DvarToraEditor'
import { Settings } from './components/Settings'
import type { WeeklyCollection, DvarTora } from './lib/types'

type View = 'dashboard' | 'suggestions' | 'editor'

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [collection, setCollection] = useState<WeeklyCollection | null>(null)
  const [dvarTora, setDvarTora] = useState<DvarTora | null>(null)
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
        <WeeklyDashboard onProceed={(c) => { setCollection(c); setView('suggestions') }} />
      )}
      {view === 'suggestions' && collection && (
        <SuggestionCards
          collection={collection}
          onSelect={(dvar) => { setDvarTora(dvar); setView('editor') }}
          onBack={() => setView('dashboard')}
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
