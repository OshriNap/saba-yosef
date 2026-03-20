import { useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { api } from '../../lib/api'
import { ChatSidebar } from './ChatSidebar'
import { SourcePanel } from './SourcePanel'
import type { DvarTora, WeeklyCollection } from '../../lib/types'

export function DvarToraEditor({ dvarTora: initial, collection, onBack }: {
  dvarTora: DvarTora
  collection: WeeklyCollection
  onBack: () => void
}) {
  const [dvarTora, setDvarTora] = useState(initial)
  const [saving, setSaving] = useState(false)
  const sessionId = `week-${collection.id}`

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'], defaultAlignment: 'right' }),
    ],
    content: dvarTora.content,
    editorProps: {
      attributes: { class: 'prose prose-lg max-w-none p-6 min-h-[400px] focus:outline-none font-serif', dir: 'rtl' },
    },
    onUpdate: ({ editor }) => {
      setDvarTora((prev) => ({ ...prev, content: editor.getHTML() }))
    },
  })

  const handleChatUpdate = useCallback((newText: string) => {
    if (editor) {
      editor.commands.setContent(newText)
      setDvarTora((prev) => ({ ...prev, content: newText }))
    }
  }, [editor])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateDvarTora(dvarTora.id, {
        content: dvarTora.content,
        title: dvarTora.title,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleFinalize = async () => {
    await api.updateDvarTora(dvarTora.id, { status: 'final' })
    setDvarTora((prev) => ({ ...prev, status: 'final' }))
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <button onClick={onBack} className="text-blue-600 hover:underline">→ חזרה</button>
        <input
          value={dvarTora.title}
          onChange={(e) => setDvarTora((prev) => ({ ...prev, title: e.target.value }))}
          className="text-2xl font-serif font-bold text-center border-none focus:outline-none"
        />
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="bg-gray-200 px-4 py-2 rounded-lg text-sm">
            {saving ? 'שומר...' : 'שמור'}
          </button>
          <button onClick={handleFinalize} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm">
            סיום
          </button>
          <a
            href={api.getPdfUrl(dvarTora.id)}
            target="_blank"
            rel="noreferrer"
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm"
          >
            PDF
          </a>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-white">
          <EditorContent editor={editor} />
        </div>
        <div className="w-80 bg-gray-50">
          <ChatSidebar
            sessionId={sessionId}
            currentText={dvarTora.content}
            onUpdate={handleChatUpdate}
          />
        </div>
      </div>
      <SourcePanel sources={dvarTora.sources} />
    </div>
  )
}
