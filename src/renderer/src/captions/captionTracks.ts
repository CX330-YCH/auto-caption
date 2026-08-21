import type {
  CaptionBoundaryMode,
  CaptionItem,
  CaptionPhase
} from '../../../shared/types'
import { segmentGraphemes, type VisualLineSlice } from './visualLines.ts'

export type CaptionTrackKind = 'source' | 'translation'

export interface CaptionTrackSegment {
  captionId: string
  kind: CaptionTrackKind
  text: string
  textOffset: number
  phase: CaptionPhase
}

export interface CaptionTrackSpan {
  captionId: string
  kind: CaptionTrackKind
  start: number
  end: number
  captionOffset: number
  phase: CaptionPhase
}

export interface CaptionTrackAnchor {
  captionId: string
  kind: CaptionTrackKind
  captionOffset: number
}

export interface ComposedCaptionTrack {
  kind: CaptionTrackKind
  text: string
  spans: CaptionTrackSpan[]
}

export interface RollingCaptionLine {
  key: string
  captionId: string
  kind: CaptionTrackKind
  captionOffset: number
  start: number
  end: number
  text: string
  phase: CaptionPhase
  breakKind: RollingLineBreakKind
}

export type RollingLineBreakKind = 'soft' | 'hard' | 'end'

export type CaptionTrackMutation =
  | 'unchanged'
  | 'lifecycle-only'
  | 'tail-growth'
  | 'tail-revision'
  | 'tail-append'
  | 'historical-change'
  | 'clear'

const DEFAULT_MAX_SEGMENTS = 256
const DEFAULT_MAX_CHARACTERS = 16_384
const CJK_CHARACTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
const CLOSING_PUNCTUATION = /^[,.;:!?%)}\]，。！？、；：）》】」』]/u

export function buildCaptionTrackSegments(
  captions: readonly CaptionItem[],
  kind: CaptionTrackKind
): CaptionTrackSegment[] {
  const segments: CaptionTrackSegment[] = []

  for (const caption of captions) {
    const text = kind === 'source' ? caption.text : caption.translation
    if (!text) continue
    segments.push({
      captionId: caption.captionId,
      kind,
      text,
      textOffset: 0,
      phase: caption.phase
    })
  }

  return segments
}

export function selectCaptionTrackWindow(
  segments: readonly CaptionTrackSegment[],
  requestedSegments: number,
  maxSegments = DEFAULT_MAX_SEGMENTS,
  maxCharacters = DEFAULT_MAX_CHARACTERS
): CaptionTrackSegment[] {
  const segmentLimit = Math.max(
    1,
    Math.min(Math.floor(requestedSegments), Math.floor(maxSegments))
  )
  const characterLimit = Math.max(1, Math.floor(maxCharacters))
  const selected = segments.slice(-segmentLimit).map(segment => ({ ...segment }))
  let remainingCharacters = characterLimit

  for (let index = selected.length - 1; index >= 0; index--) {
    const segment = selected[index]
    if (segment.text.length <= remainingCharacters) {
      remainingCharacters -= segment.text.length
      continue
    }

    if (remainingCharacters === 0) {
      return selected.slice(index + 1)
    }

    const start = safeCodeUnitStart(
      segment.text,
      segment.text.length - remainingCharacters
    )
    selected.splice(0, index)
    selected[0] = {
      ...segment,
      text: segment.text.slice(start),
      textOffset: segment.textOffset + start
    }
    return selected
  }

  return selected
}

export function selectCaptionTrackFromAnchor(
  segments: readonly CaptionTrackSegment[],
  anchor: CaptionTrackAnchor,
  maxSegments = DEFAULT_MAX_SEGMENTS,
  maxCharacters = DEFAULT_MAX_CHARACTERS
): CaptionTrackSegment[] {
  const anchorIndex = segments.findIndex(segment => {
    return segment.captionId === anchor.captionId && segment.kind === anchor.kind
  })
  if (anchorIndex < 0) {
    return selectCaptionTrackWindow(
      segments,
      maxSegments,
      maxSegments,
      maxCharacters
    )
  }

  const anchored = segments.slice(anchorIndex).map(segment => ({ ...segment }))
  const first = anchored[0]
  const cropStart = Math.max(0, anchor.captionOffset - first.textOffset)
  first.text = first.text.slice(cropStart)
  first.textOffset += cropStart
  if (!first.text) anchored.shift()
  return selectCaptionTrackWindow(
    anchored,
    maxSegments,
    maxSegments,
    maxCharacters
  )
}

export function composeCaptionTrack(
  segments: readonly CaptionTrackSegment[],
  boundaryMode: CaptionBoundaryMode
): ComposedCaptionTrack {
  const kind = segments[0]?.kind ?? 'source'
  const spans: CaptionTrackSpan[] = []
  let text = ''
  let previous: CaptionTrackSegment | undefined

  for (const segment of segments) {
    if (previous) {
      text += boundaryMode === 'sentence'
        ? '\n'
        : captionSegmentSeparator(previous.text, segment.text)
    }
    const start = text.length
    text += segment.text
    spans.push({
      captionId: segment.captionId,
      kind: segment.kind,
      start,
      end: text.length,
      captionOffset: segment.textOffset,
      phase: segment.phase
    })
    previous = segment
  }

  return { kind, text, spans }
}

export function captionSegmentSeparator(
  previousText: string,
  nextText: string
): string {
  if (!previousText || !nextText) return ''
  if (/\s$/u.test(previousText) || /^\s/u.test(nextText)) return ''

  const firstCharacter = Array.from(nextText)[0] ?? ''
  if (CJK_CHARACTER.test(firstCharacter)) return ''
  if (CLOSING_PUNCTUATION.test(firstCharacter)) return ''
  return ' '
}

export function buildRollingCaptionLines(
  track: ComposedCaptionTrack,
  visualLines: readonly VisualLineSlice[]
): RollingCaptionLine[] {
  return visualLines.map((line, index) => {
    const anchor = findLineAnchor(track.spans, line.start)
    const phase = resolveLinePhase(track.spans, line.start, line.end)
    const nextLine = visualLines[index + 1]
    const captionOffset = anchor === undefined
      ? line.start
      : anchor.captionOffset + Math.max(0, line.start - anchor.start)
    const captionId = anchor?.captionId ?? 'empty'

    return {
      key: `${track.kind}:${captionId}:${captionOffset}`,
      captionId,
      kind: track.kind,
      captionOffset,
      start: line.start,
      end: line.end,
      text: line.text,
      phase,
      breakKind: nextLine === undefined
        ? 'end'
        : nextLine.start === line.end
          ? 'soft'
          : 'hard'
    }
  })
}

export function shouldJustifyRollingLine(
  line: Pick<RollingCaptionLine, 'text' | 'breakKind'>
): boolean {
  return line.breakKind === 'soft' &&
    segmentGraphemes(line.text.trim()).length > 1
}

export function captionTrackAnchorAtOffset(
  track: ComposedCaptionTrack,
  offset: number
): CaptionTrackAnchor | undefined {
  const span = findLineAnchor(track.spans, offset)
  if (!span) return undefined
  return {
    captionId: span.captionId,
    kind: span.kind,
    captionOffset: span.captionOffset + Math.max(0, offset - span.start)
  }
}

export function selectRollingCaptionLines(
  rows: readonly RollingCaptionLine[],
  maximumRows: number
): RollingCaptionLine[] {
  const rowCount = Math.max(1, Math.floor(maximumRows))
  return rows.slice(-rowCount)
}

export function classifyCaptionTrackMutation(
  previous: readonly CaptionTrackSegment[],
  next: readonly CaptionTrackSegment[]
): CaptionTrackMutation {
  if (sameTrackContent(previous, next)) return 'unchanged'
  if (previous.length === 0 && next.length > 0) return 'tail-append'
  if (next.length === 0) return 'clear'

  if (previous.length === next.length && sameTrackIds(previous, next)) {
    const changedTextPositions = previous
      .map((segment, index) => segment.text === next[index].text ? -1 : index)
      .filter(index => index >= 0)
    if (
      changedTextPositions.length === 1 &&
      changedTextPositions[0] === previous.length - 1
    ) {
      const previousText = previous.at(-1)?.text ?? ''
      const nextText = next.at(-1)?.text ?? ''
      return nextText.length > previousText.length &&
        nextText.startsWith(previousText)
        ? 'tail-growth'
        : 'tail-revision'
    }
    return changedTextPositions.length === 0
      ? 'lifecycle-only'
      : 'historical-change'
  }

  if (next.length > previous.length) {
    const prefixIsStable = previous.every((segment, index) => {
      const nextSegment = next[index]
      return nextSegment !== undefined &&
        segment.captionId === nextSegment.captionId &&
        segment.kind === nextSegment.kind &&
        segment.text === nextSegment.text
    })
    if (prefixIsStable) return 'tail-append'
  }

  return 'historical-change'
}

function sameTrackContent(
  left: readonly CaptionTrackSegment[],
  right: readonly CaptionTrackSegment[]
): boolean {
  return left.length === right.length && left.every((segment, index) => {
    const compared = right[index]
    return compared !== undefined &&
      segment.captionId === compared.captionId &&
      segment.kind === compared.kind &&
      segment.text === compared.text &&
      segment.textOffset === compared.textOffset &&
      segment.phase === compared.phase
  })
}

function sameTrackIds(
  left: readonly CaptionTrackSegment[],
  right: readonly CaptionTrackSegment[]
): boolean {
  return left.every((segment, index) => {
    const compared = right[index]
    return compared !== undefined &&
      segment.captionId === compared.captionId &&
      segment.kind === compared.kind
  })
}

function findLineAnchor(
  spans: readonly CaptionTrackSpan[],
  lineStart: number
): CaptionTrackSpan | undefined {
  return spans.find(span => span.end > lineStart) ?? spans.at(-1)
}

function resolveLinePhase(
  spans: readonly CaptionTrackSpan[],
  lineStart: number,
  lineEnd: number
): CaptionPhase {
  const intersecting = spans.filter(span => {
    if (lineStart === lineEnd) {
      return span.start <= lineStart && span.end >= lineEnd
    }
    return span.end > lineStart && span.start < lineEnd
  })
  if (intersecting.some(span => span.phase === 'partial')) return 'partial'
  if (intersecting.some(span => span.phase === 'unknown')) return 'unknown'
  return 'final'
}

function safeCodeUnitStart(text: string, requestedStart: number): number {
  let start = Math.max(0, Math.min(requestedStart, text.length))
  const current = text.charCodeAt(start)
  if (current >= 0xDC00 && current <= 0xDFFF) start += 1
  return start
}
