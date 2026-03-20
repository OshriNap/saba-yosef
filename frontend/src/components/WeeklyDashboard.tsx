import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { WeeklyCollection } from '../lib/types'
import { NewsSummary } from './NewsSummary'

export function WeeklyDashboard({ onProceed }: { onProceed: (collection: WeeklyCollection) => void }) {
  const [collection, setCollection] = useState<WeeklyCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getCurrentWeek()
      .then(setCollection)
      .catch(() => setError('לא נמצאו נתונים לשבוע זה'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-20 text-lg">טוען...</div>
  if (error) return <div className="text-center py-20 text-red-600">{error}</div>
  if (!collection) return null

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-serif font-bold mb-2">{collection.parasha_name}</h1>
        <p className="text-gray-500">{collection.hebrew_date} | {collection.gregorian_date}</p>
        <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm ${
          collection.status === 'collected' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          {collection.status === 'collected' ? 'הנתונים מוכנים' : 'בתהליך איסוף'}
        </span>
      </header>
      <NewsSummary items={collection.news_items} />
      <div className="text-center mt-10">
        <button
          onClick={() => onProceed(collection)}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700 transition"
          disabled={collection.status !== 'collected'}
        >
          המשך להצעות דבר תורה
        </button>
      </div>
    </div>
  )
}
