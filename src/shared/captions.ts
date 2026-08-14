import type { CaptionItem } from './types.ts'

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
