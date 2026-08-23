export interface EngineMessage {
  command: string
  [key: string]: unknown
}

export interface CaptionEngineMessage extends EngineMessage {
  command: 'caption'
  event_version?: 1
  phase?: 'partial' | 'final'
  index: number
  time_s: string
  time_t: string
  text: string
  translation: string
}

export interface TranslationEngineMessage extends EngineMessage {
  command: 'translation'
  caption_id?: number
  time_s: string
  text: string
  translation: string
}

export interface CaptionRemoveEngineMessage extends EngineMessage {
  command: 'caption_remove'
  event_version: 1
  index: number
}

export interface ContentEngineMessage extends EngineMessage {
  content: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isEngineMessage(value: unknown): value is EngineMessage {
  return isRecord(value) && typeof value.command === 'string'
}

export function isCaptionEngineMessage(
  value: EngineMessage
): value is CaptionEngineMessage {
  const hasEventVersion = value.event_version !== undefined
  const hasPhase = value.phase !== undefined
  const validLifecycleMetadata = !hasEventVersion && !hasPhase ||
    value.event_version === 1 &&
    (value.phase === 'partial' || value.phase === 'final')

  return value.command === 'caption' &&
    validLifecycleMetadata &&
    typeof value.index === 'number' &&
    Number.isFinite(value.index) &&
    typeof value.time_s === 'string' &&
    typeof value.time_t === 'string' &&
    typeof value.text === 'string' &&
    typeof value.translation === 'string'
}

export function isTranslationEngineMessage(
  value: EngineMessage
): value is TranslationEngineMessage {
  return value.command === 'translation' &&
    (value.caption_id === undefined || (
      typeof value.caption_id === 'number' &&
      Number.isFinite(value.caption_id)
    )) &&
    typeof value.time_s === 'string' &&
    typeof value.text === 'string' &&
    typeof value.translation === 'string'
}

export function isCaptionRemoveEngineMessage(
  value: EngineMessage
): value is CaptionRemoveEngineMessage {
  return value.command === 'caption_remove' &&
    value.event_version === 1 &&
    typeof value.index === 'number' &&
    Number.isFinite(value.index)
}

export function isContentEngineMessage(
  value: EngineMessage
): value is ContentEngineMessage {
  return typeof value.content === 'string'
}
