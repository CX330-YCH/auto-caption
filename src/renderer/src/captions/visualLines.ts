export interface GraphemeSegment {
  start: number
  end: number
  text: string
}

export interface PositionedGrapheme extends GraphemeSegment {
  lineTop?: number
}

export interface VisualLineSlice {
  text: string
  start: number
  end: number
}

export function segmentGraphemes(text: string): GraphemeSegment[] {
  if (!text) return []

  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), part => ({
      start: part.index,
      end: part.index + part.segment.length,
      text: part.segment
    }))
  }

  const segments: GraphemeSegment[] = []
  let index = 0
  for (const grapheme of Array.from(text)) {
    segments.push({
      start: index,
      end: index + grapheme.length,
      text: grapheme
    })
    index += grapheme.length
  }
  return segments
}

export function buildVisualLines(
  text: string,
  segments: PositionedGrapheme[]
): string[] {
  return buildVisualLineSlices(text, segments).map(line => line.text)
}

export function buildVisualLineSlices(
  text: string,
  segments: PositionedGrapheme[]
): VisualLineSlice[] {
  if (!text) return []

  const lines: VisualLineSlice[] = []
  let lineStart = 0
  let currentTop: number | undefined

  for (const segment of segments) {
    if (segment.text === '\n') {
      lines.push(createVisualLineSlice(text, lineStart, segment.start))
      lineStart = segment.end
      currentTop = undefined
      continue
    }

    if (segment.lineTop === undefined) continue
    if (currentTop === undefined) {
      currentTop = segment.lineTop
      continue
    }
    if (Math.abs(segment.lineTop - currentTop) <= 0.5) continue

    lines.push(createVisualLineSlice(text, lineStart, segment.start))
    lineStart = segment.start
    currentTop = segment.lineTop
  }

  lines.push(createVisualLineSlice(text, lineStart, text.length))
  return lines
}

function createVisualLineSlice(
  text: string,
  start: number,
  end: number
): VisualLineSlice {
  return {
    text: text.slice(start, end),
    start,
    end
  }
}

/**
 * Reads Chromium's real inline boxes from a hidden mirror containing one text
 * node. The returned strings can be rendered as explicit visual rows by any
 * caption presentation component using the same typography and width.
 */
export function measureVisualLines(element: HTMLElement, text: string): string[] {
  return measureVisualLineSlices(element, text).map(line => line.text)
}

export function measureVisualLineSlices(
  element: HTMLElement,
  text: string
): VisualLineSlice[] {
  if (!text) return []
  const textNode = element.firstChild
  if (!(textNode instanceof Text) || textNode.data !== text) {
    return [createVisualLineSlice(text, 0, text.length)]
  }

  const range = document.createRange()
  const positioned = segmentGraphemes(text).map(segment => {
    if (segment.text === '\n') return segment
    range.setStart(textNode, segment.start)
    range.setEnd(textNode, segment.end)
    const rects = range.getClientRects()
    const rect = rects.length > 0
      ? rects.item(rects.length - 1)
      : range.getBoundingClientRect()
    return {
      ...segment,
      lineTop: rect && Number.isFinite(rect.top) ? rect.top : undefined
    }
  })
  range.detach()
  return buildVisualLineSlices(text, positioned)
}
