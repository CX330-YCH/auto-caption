import {
  selectRollingCaptionLines,
  type CaptionTrackAnchor,
  type ComposedCaptionTrack,
  type RollingCaptionLine
} from './captionTracks.ts'

export interface RollingTrackPresentationState {
  displayFloor?: CaptionTrackAnchor
  visibleRows: RollingCaptionLine[]
}

export interface RollingTrackPresentationUpdate {
  state: RollingTrackPresentationState
  animate: boolean
}

export function createRollingTrackPresentationState(): RollingTrackPresentationState {
  return { visibleRows: [] }
}

export function resetRollingTrackDisplayFloor(
  state: RollingTrackPresentationState
): RollingTrackPresentationState {
  return {
    visibleRows: state.visibleRows.map(row => ({ ...row }))
  }
}

export function updateRollingTrackPresentation(
  state: RollingTrackPresentationState,
  track: ComposedCaptionTrack,
  measuredRows: readonly RollingCaptionLine[],
  maximumRows: number,
  animationEligible: boolean
): RollingTrackPresentationUpdate {
  const floor = state.displayFloor
  const eligibleRows = floor
    ? measuredRows.filter(row => isAtOrAfterDisplayFloor(
        row,
        floor,
        track
      ))
    : measuredRows
  const visibleRows = selectRollingCaptionLines(eligibleRows, maximumRows)
  const candidateFloor = visibleRows[0]
    ? rowAnchor(visibleRows[0])
    : undefined
  const displayFloor = laterAnchor(
    state.displayFloor,
    candidateFloor,
    track
  )
  const animate = animationEligible &&
    state.visibleRows.length > 0 &&
    visibleRows.some(row => {
      return !state.visibleRows.some(previous => previous.key === row.key)
    })

  return {
    state: {
      displayFloor,
      visibleRows: visibleRows.map(row => ({ ...row }))
    },
    animate
  }
}

function isAtOrAfterDisplayFloor(
  row: RollingCaptionLine,
  floor: CaptionTrackAnchor,
  track: ComposedCaptionTrack
): boolean {
  return compareAnchors(rowAnchor(row), floor, track) >= 0
}

function laterAnchor(
  current: CaptionTrackAnchor | undefined,
  candidate: CaptionTrackAnchor | undefined,
  track: ComposedCaptionTrack
): CaptionTrackAnchor | undefined {
  if (!candidate) return current ? { ...current } : undefined
  if (!current || compareAnchors(candidate, current, track) >= 0) {
    return { ...candidate }
  }
  return { ...current }
}

function compareAnchors(
  left: CaptionTrackAnchor,
  right: CaptionTrackAnchor,
  track: ComposedCaptionTrack
): number {
  if (left.captionId === right.captionId && left.kind === right.kind) {
    return left.captionOffset - right.captionOffset
  }

  const leftPosition = track.spans.findIndex(span => {
    return span.captionId === left.captionId && span.kind === left.kind
  })
  const rightPosition = track.spans.findIndex(span => {
    return span.captionId === right.captionId && span.kind === right.kind
  })
  if (leftPosition < 0) return rightPosition < 0 ? 0 : -1
  if (rightPosition < 0) return 1
  return leftPosition - rightPosition
}

function rowAnchor(row: RollingCaptionLine): CaptionTrackAnchor {
  return {
    captionId: row.captionId,
    kind: row.kind,
    captionOffset: row.captionOffset
  }
}
