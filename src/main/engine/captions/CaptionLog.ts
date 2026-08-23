import type { CaptionItem } from '../../../shared/types.ts'
import {
  IncrementalCaptionCollection,
  type CaptionCollectionChange
} from '../../../shared/captions.ts'
import type {
  CaptionRemoveEngineMessage,
  CaptionEngineMessage,
  TranslationEngineMessage
} from '../protocol/messages.ts'

export type CaptionLogChange = CaptionCollectionChange

export class CaptionLog {
  private readonly captions = new IncrementalCaptionCollection()

  public get items(): CaptionItem[] {
    return this.captions.items
  }

  public upsert(
    engineRunId: number,
    message: CaptionEngineMessage
  ): CaptionLogChange[] {
    const captionId = this.captionId(engineRunId, message.index)
    const item: CaptionItem = {
      captionId,
      index: this.displayIndex(captionId),
      time_s: message.time_s,
      time_t: message.time_t,
      text: message.text,
      translation: message.translation,
      phase: message.phase ?? 'unknown'
    }
    return this.captions.upsert(item)
  }

  public applyTranslation(
    engineRunId: number,
    message: TranslationEngineMessage
  ): CaptionLogChange | undefined {
    const position = message.caption_id === undefined
      ? this.findLegacyPosition(message.time_s)
      : this.findPosition(this.captionId(engineRunId, message.caption_id))

    if (position === undefined) return undefined

    return this.captions.updateTranslation(
      this.items[position].captionId,
      message.translation
    )
  }

  public remove(
    engineRunId: number,
    message: CaptionRemoveEngineMessage
  ): string | undefined {
    const captionId = this.captionId(engineRunId, message.index)
    return this.captions.remove(captionId)?.captionId
  }

  public clear(): void {
    this.captions.clear()
  }

  private captionId(engineRunId: number, engineCaptionId: number): string {
    return `${engineRunId}:${engineCaptionId}`
  }

  private findLegacyPosition(timeStart: string): number | undefined {
    for (let position = this.items.length - 1; position >= 0; position--) {
      if (this.items[position].time_s === timeStart) return position
    }
    return undefined
  }

  private displayIndex(captionId: string): number {
    const position = this.findPosition(captionId)
    return (position ?? this.items.length) + 1
  }

  private findPosition(captionId: string): number | undefined {
    return this.captions.findPosition(captionId)
  }
}
