<template>
  <div
    ref="container"
    class="exact-caption-text"
    :data-phase="phase"
    :style="textStyle"
  >
    <span v-if="!wrap" class="single-line">
      <span class="single-line-content">{{ text }}</span>
    </span>
    <template v-else>
      <span
        v-for="(line, index) in lines"
        :key="`${index}:${line.start}:${line.end}`"
        class="visual-line"
      >{{ line.text || '\u00a0' }}</span>
      <span
        ref="measurement"
        class="measurement"
        aria-hidden="true"
      >{{ text }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CaptionPhase } from '../../../../shared/types'
import {
  measureVisualLineSlices,
  type VisualLineSlice
} from '../../captions/visualLines'

type MeasurementReason = 'content' | 'layout'

const props = defineProps<{
  text: string
  wrap: boolean
  fontFamily: string
  fontSize: number
  fontColor: string
  fontWeight: number
  phase: CaptionPhase
}>()

const emit = defineEmits<{
  beforeMeasure: [reason: MeasurementReason]
  lineSlicesChange: [
    text: string,
    lines: VisualLineSlice[],
    reason: MeasurementReason
  ]
}>()

const container = ref<HTMLElement>()
const measurement = ref<HTMLElement>()
const lines = ref<VisualLineSlice[]>(props.text
  ? [{ text: props.text, start: 0, end: props.text.length }]
  : [])
let animationFrame: number | undefined
let resizeObserver: ResizeObserver | undefined
let hasReportedLines = false
let pendingReason: MeasurementReason = 'layout'
let measuredWidth: number | undefined

const textStyle = computed(() => ({
  fontFamily: props.fontFamily,
  fontSize: `${props.fontSize}px`,
  color: props.fontColor,
  fontWeight: props.fontWeight * 100
}))

function scheduleMeasurement(reason: MeasurementReason): void {
  if (reason === 'layout' || animationFrame === undefined) {
    pendingReason = reason
  }
  if (!props.wrap) {
    updateLines(
      props.text
        ? [{ text: props.text, start: 0, end: props.text.length }]
        : [],
      pendingReason
    )
    return
  }
  if (animationFrame !== undefined) cancelAnimationFrame(animationFrame)
  animationFrame = requestAnimationFrame(() => {
    animationFrame = undefined
    const mirror = measurement.value
    if (!mirror) return
    const reason = pendingReason
    emit('beforeMeasure', reason)
    updateLines(measureVisualLineSlices(mirror, props.text), reason)
  })
}

function updateLines(
  nextLines: VisualLineSlice[],
  reason: MeasurementReason
): void {
  const unchanged =
    lines.value.length === nextLines.length &&
    lines.value.every((line, index) => {
      const next = nextLines[index]
      return next !== undefined &&
        line.text === next.text &&
        line.start === next.start &&
        line.end === next.end
    })
  if (!unchanged) lines.value = nextLines
  if (unchanged && hasReportedLines && reason !== 'layout') return
  hasReportedLines = true
  emit(
    'lineSlicesChange',
    props.text,
    nextLines.map(line => ({ ...line })),
    reason
  )
}

function handleFontLoading(): void {
  scheduleMeasurement('layout')
}

watch(
  () => props.text,
  () => {
    void nextTick(() => scheduleMeasurement('content'))
  },
  { flush: 'post' }
)

watch(
  () => [
    props.wrap,
    props.fontFamily,
    props.fontSize,
    props.fontWeight
  ],
  () => {
    void nextTick(() => scheduleMeasurement('layout'))
  },
  { flush: 'post' }
)

onMounted(() => {
  resizeObserver = new ResizeObserver(entries => {
    const width = entries[0]?.contentRect.width
    if (width === undefined) return
    if (measuredWidth !== undefined && Math.abs(width - measuredWidth) <= 0.5) {
      return
    }
    measuredWidth = width
    scheduleMeasurement('layout')
  })
  if (container.value) resizeObserver.observe(container.value)
  document.fonts?.addEventListener('loadingdone', handleFontLoading)
  void document.fonts?.ready.then(() => scheduleMeasurement('layout'))
  scheduleMeasurement('layout')
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  document.fonts?.removeEventListener('loadingdone', handleFontLoading)
  if (animationFrame !== undefined) cancelAnimationFrame(animationFrame)
})
</script>

<style scoped>
.exact-caption-text {
  position: relative;
  width: 100%;
  min-width: 0;
  line-height: 1.6em;
  text-align: center;
}

.visual-line,
.measurement {
  box-sizing: border-box;
  width: 100%;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: normal;
  line-break: auto;
}

.visual-line {
  display: block;
}

.measurement {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  visibility: hidden;
  pointer-events: none;
}

.single-line {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  direction: rtl;
  text-align: left;
}

.single-line-content {
  display: inline-block;
  direction: ltr;
}
</style>
