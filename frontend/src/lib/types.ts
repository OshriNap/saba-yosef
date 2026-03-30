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

export interface ParashaTheme {
  title: string
  description: string
}

export interface Connection {
  news_index: number
  theme_index: number
  strength: number
  reason: string
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
  parasha_themes: ParashaTheme[]
  connections: Connection[]
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

export interface MefarshimResult {
  mefaresh: string
  ref: string
  summary: string
  original_text: string
  source: 'db' | 'new'
  selected: boolean
}

export interface RhetoricStrategy {
  id: number
  key: string
  name: string
  description: string
  structure_template: string
  example: string
  is_custom: boolean
  display_order: number
}

export interface DrashaBeat {
  strategy_name: string
  beat: string
}

export type RhetoricalMove = 'hook' | 'build' | 'surprise' | 'deepen' | 'resolve' | 'land'

export interface FlowSection {
  id: string
  title: string
  description: string
  rhetoricalMove: RhetoricalMove
  assignedNews: number[]
  assignedThemes: number[]
  mefareshSlot: string
  transitionTo: string
  estimatedMinutes: number
}

export interface DrashaFlow {
  id?: number
  collectionId: number
  punchline: string
  sections: FlowSection[]
  totalMinutes: number
  createdAt?: string
  updatedAt?: string
}
