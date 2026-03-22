import type { WeeklyCollection, DvarToraSuggestion, DvarTora, MefarshimResult, RhetoricStrategy, DrashaBeat } from './types'

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

  streamSuggestionsFocused: async (
    collectionId: number,
    selection: {
      selectedNews: number[]
      selectedThemes: number[]
      customNews: string[]
      customThemes: string[]
      style?: { tone: string; audience: string; length: string; approach: string }
      mefarshimSummaries?: { mefaresh: string; ref: string; summary: string }[]
    },
    onChunk: (text: string) => void,
    onDone: (suggestions: DvarToraSuggestion[]) => void,
    onHeartbeat?: () => void,
  ) => {
    const resp = await fetch(`${BASE}/dvar-tora/suggestions/${collectionId}/stream-from-selection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selected_news: selection.selectedNews,
        selected_themes: selection.selectedThemes,
        custom_news: selection.customNews,
        custom_themes: selection.customThemes,
        style: selection.style || null,
        mefarshim_summaries: (selection.mefarshimSummaries || []).map(m => ({
          mefaresh: m.mefaresh,
          ref: m.ref,
          summary: m.summary,
        })),
      }),
    })
    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = JSON.parse(line.slice(6))
        if (data.type === 'chunk') onChunk(data.text)
        else if (data.type === 'heartbeat') onHeartbeat?.()
        else if (data.type === 'done') onDone(data.suggestions)
      }
    }
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

  streamMefarshimResearch: async (
    collectionId: number,
    request: {
      selected_news: number[]
      selected_themes: number[]
      custom_news: string[]
      custom_themes: string[]
      categories: string[]
    },
    onResult: (result: MefarshimResult) => void,
    onPhase: (phase: string, count: number) => void,
    onDone: () => void,
  ) => {
    const resp = await fetch(`${BASE}/mefarshim/${collectionId}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = JSON.parse(line.slice(6))
        if (data.type === 'mefaresh') onResult({ ...data, selected: true })
        else if (data.type === 'phase') onPhase(data.phase, data.count)
        else if (data.type === 'done') onDone()
      }
    }
  },

  getRhetoricStrategies: () =>
    fetchJSON<RhetoricStrategy[]>('/rhetoric/'),

  createRhetoricStrategy: (data: { name: string; description: string; structure_template: string; example?: string }) =>
    fetchJSON<RhetoricStrategy>('/rhetoric/', { method: 'POST', body: JSON.stringify(data) }),

  updateRhetoricStrategy: (id: number, data: Partial<RhetoricStrategy>) =>
    fetchJSON<RhetoricStrategy>(`/rhetoric/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteRhetoricStrategy: (id: number) =>
    fetchJSON<{ ok: boolean }>(`/rhetoric/${id}`, { method: 'DELETE' }),

  streamPunchlines: async (
    collectionId: number,
    request: {
      selected_news: number[]
      selected_themes: number[]
      custom_news: string[]
      custom_themes: string[]
      rhetoric_sequence: { name: string; description: string; structure_template: string }[]
    },
    onDone: (punchlines: string[]) => void,
    onHeartbeat?: () => void,
  ) => {
    const resp = await fetch(`${BASE}/rhetoric/${collectionId}/punchlines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = JSON.parse(line.slice(6))
        if (data.type === 'heartbeat') onHeartbeat?.()
        else if (data.type === 'done') onDone(data.punchlines)
      }
    }
  },

  streamBeats: async (
    collectionId: number,
    request: {
      punchline: string
      selected_news: number[]
      selected_themes: number[]
      custom_news: string[]
      custom_themes: string[]
      rhetoric_sequence: { name: string; description: string; structure_template: string }[]
    },
    onDone: (beats: DrashaBeat[]) => void,
    onHeartbeat?: () => void,
  ) => {
    const resp = await fetch(`${BASE}/rhetoric/${collectionId}/beats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = JSON.parse(line.slice(6))
        if (data.type === 'heartbeat') onHeartbeat?.()
        else if (data.type === 'done') onDone(data.beats)
      }
    }
  },
}
