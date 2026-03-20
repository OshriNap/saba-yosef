import type { MefareshText } from '../../lib/types'

export function SourcePanel({ sources }: { sources: MefareshText[] }) {
  if (sources.length === 0) return null
  return (
    <div className="border-t border-gray-200 bg-gray-50 p-4">
      <h3 className="text-lg font-bold mb-3">מקורות</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sources.map((source, i) => (
          <div key={i} className="border rounded-lg p-3 bg-white">
            <div className="font-bold text-sm">{source.mefaresh}</div>
            <div className="text-xs text-gray-500 mb-1">{source.ref}</div>
            <div className="text-sm leading-relaxed">{source.text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
