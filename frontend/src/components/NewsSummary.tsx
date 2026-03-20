import type { NewsItem } from '../lib/types'

export function NewsSummary({ items }: { items: NewsItem[] }) {
  return (
    <section>
      <h2 className="text-2xl font-serif font-bold mb-4">חדשות השבוע</h2>
      <div className="grid gap-3">
        {items.slice(0, 10).map((item, i) => (
          <div key={i} className="border rounded-lg p-4 hover:bg-gray-50 transition">
            <h3 className="font-bold text-lg">{item.title}</h3>
            {item.summary && <p className="text-gray-600 mt-1">{item.summary}</p>}
            <div className="flex gap-3 mt-2 text-sm text-gray-400">
              {item.source && <span>{item.source}</span>}
              {item.published && <span>{item.published}</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
