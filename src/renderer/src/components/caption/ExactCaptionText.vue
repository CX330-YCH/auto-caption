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
        :key="`${index}:${line}`"
        class="visual-line"
      >{{ line || '\u00a0' }}</span>
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
import { measureVisualLines } from '../../captions/visualLines'

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
  linesChange: [lines: string[]]
}>()

const container = ref<HTMLElement>()
const measurement = ref<HTMLElement>()
const lines = ref<string[]>(props.text ? [props.text] : [])
let animationFrame: number | undefined
let resizeObserver: ResizeObserver | undefined
let hasReportedLines = false

const textStyle = computed(() => ({
  fontFamily: props.fontFamily,
  fontSize: `${props.fontSize}px`,
  color: props.fontColor,
  fontWeight: props.fontWeight * 100
}))

function scheduleMeasurement(): void {
  if (!props.wrap) {
    updateLines(props.text ? [props.text] : [])
    return
  }
  if (animationFrame !== undefined) cancelAnimationFrame(animationFrame)
  animationFrame = requestAnimationFrame(() => {
    animationFrame = undefined
    const mirror = measurement.value
    if (!mirror) return
    updateLines(measureVisualLines(mirror, props.text))
  })
}

function updateLines(nextLines: string[]): void {
  const unchanged =
    lines.value.length === nextLines.length &&
    lines.value.every((line, index) => line === nextLines[index])
  if (!unchanged) lines.value = nextLines
  if (unchanged && hasReportedLines) return
  hasReportedLines = true
  emit('linesChange', [...nextLines])
}

function handleFontLoading(): void {
  scheduleMeasurement()
}

watch(
  () => [
    props.text,
    props.wrap,
    props.fontFamily,
    props.fontSize,
    props.fontWeight
  ],
  () => {
    void nextTick(scheduleMeasurement)
  },
  { flush: 'post' }
)

onMounted(() => {
  resizeObserver = new ResizeObserver(scheduleMeasurement)
  if (container.value) resizeObserver.observe(container.value)
  document.fonts?.addEventListener('loadingdone', handleFontLoading)
  void document.fonts?.ready.then(scheduleMeasurement)
  scheduleMeasurement()
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
