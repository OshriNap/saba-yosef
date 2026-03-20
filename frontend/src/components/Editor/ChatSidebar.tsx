import { useState } from 'react'
import { api } from '../../lib/api'

export function ChatSidebar({ sessionId, currentText, onUpdate }: {
  sessionId: string
  currentText: string
  onUpdate: (newText: string) => void
}) {
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)
    try {
      const result = await api.chatEdit({
        current_text: currentText,
        user_request: userMsg,
        session_id: sessionId,
      })
      setMessages((prev) => [...prev, { role: 'assistant', text: 'הטקסט עודכן' }])
      onUpdate(result.updated_text)
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'שגיאה בעדכון' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full border-r border-gray-200">
      <h3 className="text-lg font-bold p-4 border-b">עוזר AI</h3>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`p-3 rounded-lg ${
            msg.role === 'user' ? 'bg-blue-100 mr-4' : 'bg-gray-100 ml-4'
          }`}>
            {msg.text}
          </div>
        ))}
        {loading && <div className="text-gray-400 text-center">חושב...</div>}
      </div>
      <div className="p-4 border-t flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="בקש שינוי, הוספת מקור..."
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          שלח
        </button>
      </div>
    </div>
  )
}
