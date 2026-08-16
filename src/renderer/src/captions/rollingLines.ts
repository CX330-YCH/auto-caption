import type { CaptionItem, CaptionPhase } from '../../../shared/types'

export type CaptionLineKind = 'source' | 'translation'

export interface CaptionLineMeasurement {
  source: readonly string[]
  translation: readonly string[]
}

export interface RollingCaptionLine {
  key: string
  captionId: string
  kind: CaptionLineKind
  lineIndex: number
  text: string
  phase: CaptionPhase
}

export interface RollingCaptionTracks {
  source: RollingCaptionLine[]
  translation: RollingCaptionLine[]
}

export function buildRollingCaptionTracks(
  captions: readonly CaptionItem[],
  measurements: ReadonlyMap<string, CaptionLineMeasurement>,
  showTranslation: boolean
): RollingCaptionTracks {
  const tracks: RollingCaptionTracks = {
    source: [],
    translation: []
  }

  for (const caption of captions) {
    const measurement = measurements.get(caption.captionId)
    appendLines(
      tracks.source,
      caption,
      'source',
      measurement?.source ?? []
    )
    if (showTranslation && caption.translation) {
      appendLines(
        tracks.translation,
        caption,
        'translation',
        measurement?.translation ?? []
      )
    }
  }

  return tracks
}

export function selectRollingCaptionLines(
  rows: readonly RollingCaptionLine[],
  maximumRows: number
): RollingCaptionLine[] {
  const rowCount = Math.max(1, Math.floor(maximumRows))
  return rows.slice(-rowCount)
}

function appendLines(
  target: RollingCaptionLine[],
  caption: CaptionItem,
  kind: CaptionLineKind,
  lines: readonly string[]
): void {
  lines.forEach((text, lineIndex) => {
    target.push({
      key: `${caption.captionId}:${kind}:${lineIndex}`,
      captionId: caption.captionId,
      kind,
      lineIndex,
      text,
      phase: caption.phase
    })
  })
}
