<template>
  <div
    class="rolling-caption-track"
    :data-kind="kind"
    :data-line-capacity="visibleLineCount"
    :style="trackStyle"
  >
    <TransitionGroup
      name="rolling-line"
      tag="div"
      class="rolling-line-list"
      :css="animateRows"
    >
      <div
        v-for="row in visibleRows"
        :key="row.key"
        class="rolling-line"
        :class="{ justified: shouldJustifyRollingLine(row) }"
        :data-phase="row.phase"
        :data-kind="row.kind"
        :data-break-kind="row.breakKind"
        :style="lineStyle"
      >{{ row.text || '\u00a0' }}</div>
    </TransitionGroup>

    <div class="rolling-track-measurement" aria-hidden="true">
      <ExactCaptionText
        :text="composedTrack.text"
        wrap
        :font-family="fontFamily"
        :font-size="fontSize"
        :font-color="fontColor"
        :font-weight="fontWeight"
        :phase="measurementPhase"
        @line-slices-change="handleLineSlicesChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  CaptionBoundaryMode,
  CaptionPhase
} from '../../../../shared/types'
import {
  buildRollingCaptionLines,
  captionTrackAnchorAtOffset,
  classifyCaptionTrackMutation,
  composeCaptionTrack,
  selectCaptionTrackFromAnchor,
  selectCaptionTrackWindow,
  selectRollingCaptionLines,
  shouldJustifyRollingLine,
  type CaptionTrackKind,
  type CaptionTrackAnchor,
  type CaptionTrackSegment
} from '../../captions/captionTracks'
import {
  createRollingTrackPresentationState,
  resetRollingTrackDisplayFloor,
  updateRollingTrackPresentation
} from '../../captions/rollingTrackState'
import {
  normalizeRollingCaptionLineCount,
  rollingCaptionTrackHeight,
  ROLLING_CAPTION_LINE_HEIGHT
} from '../../captions/captionGeometry'
import type { VisualLineSlice } from '../../captions/visualLines'
import ExactCaptionText from './ExactCaptionText.vue'

const INITIAL_SEGMENT_WINDOW = 8
const MAX_SEGMENT_WINDOW = 256

const props = defineProps<{
  kind: CaptionTrackKind
  segments: CaptionTrackSegment[]
  boundaryMode: CaptionBoundaryMode
  lineNumber: number
  fontFamily: string
  fontSize: number
  fontColor: string
  fontWeight: number
}>()

const requestedSegments = ref(INITIAL_SEGMENT_WINDOW)
const windowAnchor = ref<CaptionTrackAnchor>()
const presentationState = ref(createRollingTrackPresentationState())
const lastVisualLines = ref<VisualLineSlice[]>([])
const animateRows = ref(false)
let trackInitialized = false
let nextMeasurementAnimationEligible = false

const selectedSegments = computed(() => {
  if (windowAnchor.value) {
    return selectCaptionTrackFromAnchor(
      props.segments,
      windowAnchor.value,
      MAX_SEGMENT_WINDOW
    )
  }
  return selectCaptionTrackWindow(
    props.segments,
    requestedSegments.value,
    MAX_SEGMENT_WINDOW
  )
})

const composedTrack = computed(() => composeCaptionTrack(
  selectedSegments.value,
  props.boundaryMode
))

const visibleLineCount = computed(() =>
  normalizeRollingCaptionLineCount(props.lineNumber)
)

const visibleRows = computed(() => selectRollingCaptionLines(
  presentationState.value.visibleRows,
  visibleLineCount.value
))

const trackStyle = computed(() => ({
  height: `${rollingCaptionTrackHeight(
    visibleLineCount.value,
    props.fontSize
  )}px`
}))

const lineStyle = computed(() => ({
  fontFamily: props.fontFamily,
  fontSize: `${props.fontSize}px`,
  color: props.fontColor,
  fontWeight: props.fontWeight * 100,
  lineHeight: String(ROLLING_CAPTION_LINE_HEIGHT)
}))

const measurementPhase = computed<CaptionPhase>(() => {
  if (selectedSegments.value.some(segment => segment.phase === 'partial')) {
    return 'partial'
  }
  if (selectedSegments.value.some(segment => segment.phase === 'unknown')) {
    return 'unknown'
  }
  return 'final'
})

watch(
  () => props.segments.map(segment => ({ ...segment })),
  (next, previous) => {
    if (!trackInitialized || previous === undefined) {
      trackInitialized = true
      animateRows.value = false
      return
    }
    const mutation = classifyCaptionTrackMutation(previous, next)
    nextMeasurementAnimationEligible = mutation === 'tail-append' ||
      mutation === 'tail-growth'
    animateRows.value = false
    if (mutation === 'tail-revision' || mutation === 'historical-change') {
      resetMeasurementAnchor()
    }
    if (mutation === 'lifecycle-only') {
      refreshPresentationFromLastMeasurement()
    }
    if (mutation === 'clear') {
      requestedSegments.value = INITIAL_SEGMENT_WINDOW
      windowAnchor.value = undefined
      presentationState.value = createRollingTrackPresentationState()
      lastVisualLines.value = []
    }
  },
  { immediate: true }
)

watch(
  () => props.boundaryMode,
  () => {
    resetPresentationForLayout()
    resetMeasurementAnchor()
  }
)

watch(
  () => props.lineNumber,
  () => {
    resetPresentationForLayout()
    if (resetMeasurementAnchor()) return
    if (expandInitialMeasurementWindow(lastVisualLines.value)) return
    refreshPresentationFromLastMeasurement()
    updateMeasurementAnchor(lastVisualLines.value)
  }
)

function handleLineSlicesChange(
  measuredText: string,
  lines: VisualLineSlice[],
  reason: 'content' | 'layout'
): void {
  if (measuredText !== composedTrack.value.text) return
  if (reason === 'layout') {
    resetPresentationForLayout()
    if (
      resetMeasurementAnchor() &&
      measuredText !== composedTrack.value.text
    ) return
  }
  lastVisualLines.value = lines.map(line => ({ ...line }))
  if (
    !presentationState.value.displayFloor &&
    expandInitialMeasurementWindow(lines)
  ) {
    nextMeasurementAnimationEligible = false
    return
  }
  updatePresentation(
    lines,
    nextMeasurementAnimationEligible
  )
  nextMeasurementAnimationEligible = false
  updateMeasurementAnchor(lines)
}

function refreshPresentationFromLastMeasurement(): void {
  if (lastVisualLines.value.length === 0) return
  updatePresentation(lastVisualLines.value, false)
}

function updatePresentation(
  lines: readonly VisualLineSlice[],
  animationEligible: boolean
): void {
  const track = composedTrack.value
  const measuredRows = buildRollingCaptionLines(track, lines)
  const update = updateRollingTrackPresentation(
    presentationState.value,
    track,
    measuredRows,
    visibleLineCount.value,
    animationEligible
  )
  presentationState.value = update.state
  animateRows.value = update.animate
}

function resetPresentationForLayout(): void {
  nextMeasurementAnimationEligible = false
  animateRows.value = false
  presentationState.value = resetRollingTrackDisplayFloor(
    presentationState.value
  )
}

function updateMeasurementAnchor(lines: readonly VisualLineSlice[]): void {
  const targetRows = visibleLineCount.value + 2
  if (lines.length >= targetRows) {
    const firstRetainedLine = lines[lines.length - targetRows]
    const anchor = captionTrackAnchorAtOffset(
      composedTrack.value,
      firstRetainedLine.start
    )
    if (!sameAnchor(windowAnchor.value, anchor)) {
      windowAnchor.value = anchor
    }
  }
}

function expandInitialMeasurementWindow(
  lines: readonly VisualLineSlice[]
): boolean {
  const targetRows = visibleLineCount.value + 2
  if (lines.length >= targetRows) return false
  const currentStartIndex = firstSelectedSegmentIndex()
  if (currentStartIndex <= 0) return false
  if (requestedSegments.value >= MAX_SEGMENT_WINDOW) return false

  windowAnchor.value = undefined
  const currentWindowSize = props.segments.length - currentStartIndex
  requestedSegments.value = Math.min(
    MAX_SEGMENT_WINDOW,
    Math.max(
      currentWindowSize + 4,
      currentWindowSize * 2
    )
  )
  return true
}

function resetMeasurementAnchor(): boolean {
  if (!windowAnchor.value) return false
  const currentStartIndex = firstSelectedSegmentIndex()
  const currentWindowSize = currentStartIndex < 0
    ? INITIAL_SEGMENT_WINDOW
    : props.segments.length - currentStartIndex
  requestedSegments.value = Math.min(
    MAX_SEGMENT_WINDOW,
    Math.max(INITIAL_SEGMENT_WINDOW, currentWindowSize + 4)
  )
  windowAnchor.value = undefined
  return true
}

function firstSelectedSegmentIndex(): number {
  const first = selectedSegments.value[0]
  if (!first) return -1
  return props.segments.findIndex(segment => {
    return segment.captionId === first.captionId && segment.kind === first.kind
  })
}

function sameAnchor(
  left: CaptionTrackAnchor | undefined,
  right: CaptionTrackAnchor | undefined
): boolean {
  return left?.captionId === right?.captionId &&
    left?.kind === right?.kind &&
    left?.captionOffset === right?.captionOffset
}
</script>

<style scoped>
.rolling-caption-track,
.rolling-line-list {
  position: relative;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.rolling-line-list {
  display: flex;
  height: 100%;
  flex-direction: column;
  justify-content: flex-end;
}

.rolling-line {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  flex: none;
  text-align: left;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: normal;
  line-break: auto;
}

.rolling-line.justified {
  text-align: justify;
  text-align-last: justify;
}

.rolling-line-move,
.rolling-line-enter-active,
.rolling-line-leave-active {
  transition: transform 500ms ease, opacity 250ms ease;
}

.rolling-line-enter-from {
  opacity: 0;
  transform: translateY(100%);
}

.rolling-line-leave-active {
  position: absolute;
  left: 0;
}

.rolling-line-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

.rolling-track-measurement {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  visibility: hidden;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .rolling-line-move,
  .rolling-line-enter-active,
  .rolling-line-leave-active {
    transition: none;
  }
}
</style>
