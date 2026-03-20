export interface NewsItem {
  title: string
  summary: string
  link?: string
  source?: string
  published?: string
}

export interface MefareshText {
  mefaresh: string
  ref: string
  text: string
}

export interface WeeklyCollection {
  id: number
  parasha_name: string
  parasha_ref: string
  hebrew_date: string
  gregorian_date: string
  status: string
  news_items: NewsItem[]
  mefarshim_texts: Record<string, MefareshText[]>
  parasha_text: string
}

export interface DvarToraSuggestion {
  id: number
  collection_id: number
  title: string
  thesis: string
  outline: string
  sources: { mefaresh: string; ref: string }[]
  linked_news_themes: string[]
}

export interface DvarTora {
  id: number
  collection_id: number
  suggestion_id?: number
  title: string
  content: string
  status: string
  sources: MefareshText[]
}

export type MefarshimCategory = 'pshat' | 'hasidic' | 'mussar' | 'midrash' | 'bikoret' | 'mixed'
