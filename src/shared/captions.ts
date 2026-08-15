import type { CaptionItem, CaptionPhase } from './types.ts'

export interface CaptionCollectionChange {
  item: CaptionItem
  position: number
}

/**
 * Canonical in-memory model for caption displays and logs.
 *
 * It keeps partial updates on a stable caption ID, prevents a finalized caption
 * from returning to partial, and seals a legacy/unknown caption when the next
 * caption is inserted. Display implementations can consume the ordered items
 * without reimplementing provider-specific lifecycle rules.
 */
export class IncrementalCaptionCollection {
  private readonly entries: CaptionItem[] = []
  private readonly positions = new Map<string, number>()
  private activeCaptionId: string | undefined

  public constructor(items: CaptionItem[] = []) {
    this.replace(items)
  }

  public get items(): CaptionItem[] {
    return this.entries
  }

  public replace(items: CaptionItem[]): void {
    this.clear()
    for (const item of items) {
      const normalized = {
        ...item,
        phase: normalizeCaptionPhase(item.phase)
      }
      this.positions.set(normalized.captionId, this.entries.length)
      this.entries.push(normalized)
    }
    this.restoreActiveCaption()
  }

  public upsert(item: CaptionItem): CaptionCollectionChange[] {
    const changes: CaptionCollectionChange[] = []
    const existingPosition = this.positions.get(item.captionId)

    if (existingPosition === undefined) {
      const finalized = this.finalizeActiveCaption()
      if (finalized) changes.push(finalized)
    }

    const position = existingPosition ?? this.entries.length
    const existing = this.entries[position]
    const incomingPhase = normalizeCaptionPhase(item.phase)

    // A delayed partial must not reopen or overwrite a sentence already sealed.
    if (existing?.phase === 'final' && incomingPhase === 'partial') {
      return changes
    }

    const phase = existing?.phase === 'final' ? 'final' : incomingPhase
    const normalized: CaptionItem = {
      ...item,
      translation: item.translation || existing?.translation || '',
      phase
    }

    if (existingPosition === undefined) {
      this.entries.push(normalized)
      this.positions.set(normalized.captionId, position)
    }
    else {
      this.entries.splice(position, 1, normalized)
    }

    if (phase === 'final') {
      if (this.activeCaptionId === normalized.captionId) {
        this.activeCaptionId = undefined
      }
    }
    else {
      this.activeCaptionId = normalized.captionId
    }

    changes.push({ item: normalized, position })
    return changes
  }

  public updateTranslation(
    captionId: string,
    translation: string
  ): CaptionCollectionChange | undefined {
    const position = this.positions.get(captionId)
    if (position === undefined) return undefined

    const item = {
      ...this.entries[position],
      translation
    }
    this.entries.splice(position, 1, item)
    return { item, position }
  }

  public findPosition(captionId: string): number | undefined {
    return this.positions.get(captionId)
  }

  public clear(): void {
    this.entries.splice(0)
    this.positions.clear()
    this.activeCaptionId = undefined
  }

  private finalizeActiveCaption(): CaptionCollectionChange | undefined {
    if (!this.activeCaptionId) return undefined
    const position = this.positions.get(this.activeCaptionId)
    this.activeCaptionId = undefined
    if (position === undefined) return undefined

    const current = this.entries[position]
    if (current.phase === 'final') return undefined
    const item: CaptionItem = { ...current, phase: 'final' }
    this.entries.splice(position, 1, item)
    return { item, position }
  }

  private restoreActiveCaption(): void {
    for (let position = this.entries.length - 1; position >= 0; position--) {
      const item = this.entries[position]
      if (item.phase === 'final') continue
      this.activeCaptionId = item.captionId
      for (let previous = 0; previous < position; previous++) {
        if (this.entries[previous].phase !== 'final') {
          this.entries[previous] = {
            ...this.entries[previous],
            phase: 'final'
          }
        }
      }
      return
    }
  }
}

export function normalizeCaptionPhase(value: unknown): CaptionPhase {
  return value === 'partial' || value === 'final' ? value : 'unknown'
}

export function upsertCaptionItem(
  items: CaptionItem[],
  item: CaptionItem
): void {
  const position = items.findIndex(
    existing => existing.captionId === item.captionId
  )
  if (position === -1) {
    items.push(item)
  }
  else {
    items.splice(position, 1, item)
  }
}
