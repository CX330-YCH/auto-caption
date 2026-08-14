import type { CaptionItem } from '../../../shared/types.ts'
import type {
  CaptionEngineMessage,
  TranslationEngineMessage
} from '../protocol/messages.ts'

export interface CaptionLogChange {
  item: CaptionItem
  position: number
}

export class CaptionLog {
  private readonly entries: CaptionItem[] = []
  private readonly positions = new Map<string, number>()

  public get items(): CaptionItem[] {
    return this.entries
  }

  public upsert(
    engineRunId: number,
    message: CaptionEngineMessage
  ): CaptionLogChange {
    const captionId = this.captionId(engineRunId, message.index)
    const existingPosition = this.positions.get(captionId)
    const position = existingPosition ?? this.entries.length
    const existing = this.entries[position]
    const item: CaptionItem = {
      captionId,
      index: position + 1,
      time_s: message.time_s,
      time_t: message.time_t,
      text: message.text,
      translation: message.translation || existing?.translation || ''
    }

    if (existingPosition === undefined) {
      this.entries.push(item)
      this.positions.set(captionId, position)
    }
    else {
      this.entries.splice(position, 1, item)
    }

    return { item, position }
  }

  public applyTranslation(
    engineRunId: number,
    message: TranslationEngineMessage
  ): CaptionLogChange | undefined {
    const position = message.caption_id === undefined
      ? this.findLegacyPosition(message.time_s)
      : this.positions.get(this.captionId(engineRunId, message.caption_id))

    if (position === undefined) return undefined

    const item = {
      ...this.entries[position],
      translation: message.translation
    }
    this.entries.splice(position, 1, item)
    return { item, position }
  }

  public clear(): void {
    this.entries.splice(0)
    this.positions.clear()
  }

  private captionId(engineRunId: number, engineCaptionId: number): string {
    return `${engineRunId}:${engineCaptionId}`
  }

  private findLegacyPosition(timeStart: string): number | undefined {
    for (let position = this.entries.length - 1; position >= 0; position--) {
      if (this.entries[position].time_s === timeStart) return position
    }
    return undefined
  }
}
