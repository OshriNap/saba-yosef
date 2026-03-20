import type { WeeklyCollection, DvarToraSuggestion, DvarTora } from './types'

const BASE = import.meta.env.BASE_URL + 'api'

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!resp.ok) throw new Error(`API error: ${resp.status}`)
  return resp.json()
}

export const api = {
  getCurrentWeek: () => fetchJSON<WeeklyCollection>('/parasha/current'),

  getNews: (collectionId: number) => fetchJSON<WeeklyCollection['news_items']>(`/news/${collectionId}`),

  getSuggestions: (collectionId: number) =>
    fetchJSON<DvarToraSuggestion[]>(`/dvar-tora/suggestions/${collectionId}`),

  generateSuggestions: (collectionId: number) =>
    fetchJSON<DvarToraSuggestion[]>(`/dvar-tora/suggestions/${collectionId}/generate`, { method: 'POST' }),

  expandSuggestion: (suggestionId: number) =>
    fetchJSON<DvarTora>(`/dvar-tora/expand/${suggestionId}`, { method: 'POST' }),

  createDvarTora: (data: { collection_id: number; title: string; content?: string }) =>
    fetchJSON<DvarTora>('/dvar-tora/', { method: 'POST', body: JSON.stringify(data) }),

  updateDvarTora: (id: number, data: Partial<DvarTora>) =>
    fetchJSON<DvarTora>(`/dvar-tora/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getDvarTora: (id: number) => fetchJSON<DvarTora>(`/dvar-tora/${id}`),

  chatEdit: (data: { current_text: string; user_request: string; session_id: string }) =>
    fetchJSON<{ updated_text: string }>('/dvar-tora/chat', { method: 'POST', body: JSON.stringify(data) }),

  getPdfUrl: (dvarId: number, layout: string = 'expanded') =>
    `${BASE}/pdf/${dvarId}?layout=${layout}`,

  streamSuggestions: (collectionId: number, onChunk: (text: string) => void, onDone: (suggestions: DvarToraSuggestion[]) => void, onHeartbeat?: () => void) => {
    const es = new EventSource(`${BASE}/dvar-tora/suggestions/${collectionId}/stream`)
    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'chunk') onChunk(data.text)
      else if (data.type === 'heartbeat') onHeartbeat?.()
      else if (data.type === 'done') { onDone(data.suggestions); es.close() }
    }
    es.onerror = () => { es.close() }
    return es
  },

  streamExpand: (suggestionId: number, onChunk: (text: string) => void, onDone: (dvar: DvarTora) => void, onHeartbeat?: () => void) => {
    const es = new EventSource(`${BASE}/dvar-tora/expand/${suggestionId}/stream`)
    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'chunk') onChunk(data.text)
      else if (data.type === 'heartbeat') onHeartbeat?.()
      else if (data.type === 'done') { onDone(data.dvar_tora); es.close() }
    }
    es.onerror = () => { es.close() }
    return es
  },
}
