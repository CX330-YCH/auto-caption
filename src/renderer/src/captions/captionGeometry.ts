export const ROLLING_CAPTION_LINE_HEIGHT = 1.6

const MIN_ROLLING_CAPTION_LINES = 1
const MAX_ROLLING_CAPTION_LINES = 4

export function normalizeRollingCaptionLineCount(value: number): number {
  if (!Number.isFinite(value)) return MIN_ROLLING_CAPTION_LINES
  return Math.min(
    MAX_ROLLING_CAPTION_LINES,
    Math.max(MIN_ROLLING_CAPTION_LINES, Math.floor(value))
  )
}

export function rollingCaptionTrackHeight(
  lineNumber: number,
  fontSize: number
): number {
  const safeFontSize = Number.isFinite(fontSize)
    ? Math.max(0, fontSize)
    : 0
  return normalizeRollingCaptionLineCount(lineNumber) *
    safeFontSize *
    ROLLING_CAPTION_LINE_HEIGHT
}
