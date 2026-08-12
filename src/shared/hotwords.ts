export const HOTWORD_MAX_ENTRIES = 2000
export const HOTWORD_CONTEXT_MAX_CHARACTERS = 400

export type HotwordLanguage = 'zh' | 'en' | 'ja'

export interface HotwordEntry {
  text: string
  weight: number
  lang?: HotwordLanguage
}

export interface HotwordSummary {
  vocabularyId: string
  status: string
  createdAt: string
  modifiedAt: string
}

export interface HotwordResource extends HotwordSummary {
  targetModel: string
  vocabulary: HotwordEntry[]
}

export type HotwordRequest =
  | {
      action: 'list'
      prefix: string
      pageIndex: number
      pageSize: number
    }
  | { action: 'query'; vocabularyId: string }
  | { action: 'create'; prefix: string; vocabulary: HotwordEntry[] }
  | { action: 'update'; vocabularyId: string; vocabulary: HotwordEntry[] }
  | { action: 'delete'; vocabularyId: string }

export type HotwordErrorCode =
  | 'invalid_request'
  | 'not_configured'
  | 'key_missing'
  | 'busy'
  | 'timeout'
  | 'process_failed'
  | 'sdk_error'
  | 'model_mismatch'

export type HotwordResponse =
  | { ok: true; data: unknown }
  | { ok: false; errorCode: HotwordErrorCode }

export function parseHotwordRequest(value: unknown): HotwordRequest {
  const record = requireRecord(value)
  switch (record.action) {
    case 'list':
      return {
        action: 'list',
        prefix: requirePrefix(record.prefix, true),
        pageIndex: requireInteger(record.pageIndex, 0, 100000),
        pageSize: requireInteger(record.pageSize, 1, 50)
      }
    case 'query':
    case 'delete':
      return {
        action: record.action,
        vocabularyId: requireVocabularyId(record.vocabularyId)
      }
    case 'create':
      return {
        action: 'create',
        prefix: requirePrefix(record.prefix, false),
        vocabulary: requireVocabulary(record.vocabulary)
      }
    case 'update':
      return {
        action: 'update',
        vocabularyId: requireVocabularyId(record.vocabularyId),
        vocabulary: requireVocabulary(record.vocabulary)
      }
    default:
      throw new TypeError('Invalid hotword action')
  }
}

export function parseHotwordEntriesText(value: string): HotwordEntry[] {
  const entries = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [text = '', weight = '4', lang = ''] = line
        .split('|')
        .map((part) => part.trim())
      return {
        text,
        weight: Number(weight),
        ...(lang ? { lang } : {})
      }
    })
  return requireVocabulary(entries)
}

function requireVocabulary(value: unknown): HotwordEntry[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > HOTWORD_MAX_ENTRIES
  ) {
    throw new TypeError('Invalid hotword vocabulary')
  }
  const entries = value.map((item) => {
    const entry = requireRecord(item)
    const text = requireText(entry.text, 100)
    const containsNonAscii = [...text].some(
      (character) => (character.codePointAt(0) ?? 0) > 127
    )
    if (
      (containsNonAscii && [...text].length > 15) ||
      (!containsNonAscii && text.split(/\s+/).length > 7)
    ) {
      throw new TypeError('Invalid hotword text length')
    }
    const weight = requireInteger(entry.weight, 1, 5)
    const lang = entry.lang
    if (lang !== undefined && lang !== 'zh' && lang !== 'en' && lang !== 'ja') {
      throw new TypeError('Invalid hotword language')
    }
    const hotwordLanguage = lang as HotwordLanguage | undefined
    return { text, weight, ...(hotwordLanguage ? { lang: hotwordLanguage } : {}) }
  })
  if (new Set(entries.map((entry) => entry.text)).size !== entries.length) {
    throw new TypeError('Duplicate hotword text')
  }
  return entries
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Hotword value must be an object')
  }
  return value as Record<string, unknown>
}

function requirePrefix(value: unknown, allowEmpty: boolean): string {
  const text = requireText(value, 10, allowEmpty)
  if (text && !/^[a-z0-9]+$/.test(text)) {
    throw new TypeError('Invalid hotword prefix')
  }
  return text
}

function requireVocabularyId(value: unknown): string {
  const text = requireText(value, 256)
  if (!/^[a-zA-Z0-9_-]+$/.test(text)) {
    throw new TypeError('Invalid vocabulary ID')
  }
  return text
}

function requireText(
  value: unknown,
  maximumLength: number,
  allowEmpty: boolean = false
): string {
  if (typeof value !== 'string') throw new TypeError('Invalid text')
  const text = value.trim()
  if ((!allowEmpty && !text) || text.length > maximumLength) {
    throw new TypeError('Invalid text')
  }
  return text
}

function requireInteger(value: unknown, minimum: number, maximum: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new TypeError('Invalid integer')
  }
  return value
}
