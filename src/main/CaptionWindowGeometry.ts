export const CAPTION_WINDOW_MIN_WIDTH = 480
export const CAPTION_WINDOW_MAX_WIDTH = 10_000
export const CAPTION_WINDOW_INITIAL_HEIGHT = 100
export const CAPTION_WINDOW_MIN_HEIGHT = 22
export const CAPTION_WINDOW_MAX_HEIGHT = 16_384

export interface CaptionWindowSizeTarget {
  getSize(): number[]
  setMinimumSize(width: number, height: number): void
  setMaximumSize(width: number, height: number): void
  setSize(width: number, height: number): void
}

export function normalizeCaptionWindowHeight(
  value: unknown
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const height = Math.ceil(value)
  if (
    height < CAPTION_WINDOW_MIN_HEIGHT ||
    height > CAPTION_WINDOW_MAX_HEIGHT
  ) {
    return undefined
  }
  return height
}

export function lockCaptionWindowHeight(
  target: CaptionWindowSizeTarget,
  value: unknown
): boolean {
  const height = normalizeCaptionWindowHeight(value)
  if (height === undefined) return false

  const [reportedWidth] = target.getSize()
  if (typeof reportedWidth !== 'number' || !Number.isFinite(reportedWidth)) {
    return false
  }
  const width = Math.min(
    CAPTION_WINDOW_MAX_WIDTH,
    Math.max(CAPTION_WINDOW_MIN_WIDTH, Math.round(reportedWidth))
  )

  // Relax the previous fixed-height range before moving to the new content height.
  target.setMaximumSize(CAPTION_WINDOW_MAX_WIDTH, CAPTION_WINDOW_MAX_HEIGHT)
  target.setMinimumSize(CAPTION_WINDOW_MIN_WIDTH, CAPTION_WINDOW_MIN_HEIGHT)
  target.setSize(width, height)
  target.setMinimumSize(CAPTION_WINDOW_MIN_WIDTH, height)
  target.setMaximumSize(CAPTION_WINDOW_MAX_WIDTH, height)
  return true
}
