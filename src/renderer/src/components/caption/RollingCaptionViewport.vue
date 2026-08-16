<template>
  <div
    class="rolling-caption-viewport"
    :class="{ draggable }"
    :style="viewportStyle"
  >
    <TransitionGroup
      name="rolling-line"
      tag="div"
      class="rolling-line-list"
      data-kind="source"
    >
      <div
        v-for="row in visibleSourceRows"
        :key="row.key"
        class="rolling-line"
        :data-phase="row.phase"
        :data-kind="row.kind"
        :style="lineStyle(row.kind)"
      >{{ row.text || '\u00a0' }}</div>
    </TransitionGroup>
    <TransitionGroup
      v-if="styles.transDisplay"
      name="rolling-line"
      tag="div"
      class="rolling-line-list"
      data-kind="translation"
    >
      <div
        v-for="row in visibleTranslationRows"
        :key="row.key"
        class="rolling-line"
        :data-phase="row.phase"
        :data-kind="row.kind"
        :style="lineStyle(row.kind)"
      >{{ row.text || '\u00a0' }}</div>
    </TransitionGroup>

    <div class="rolling-measurements" aria-hidden="true">
      <template v-for="caption in measuredCaptions" :key="caption.captionId">
        <ExactCaptionText
          :text="caption.text"
          wrap
          :font-family="styles.fontFamily"
          :font-size="styles.fontSize"
          :font-color="styles.fontColor"
          :font-weight="styles.fontWeight"
          :phase="caption.phase"
          @lines-change="updateMeasurement(caption.captionId, 'source', $event)"
        />
        <ExactCaptionText
          v-if="styles.transDisplay && caption.translation"
          :text="caption.translation"
          wrap
          :font-family="styles.transFontFamily"
          :font-size="styles.transFontSize"
          :font-color="styles.transFontColor"
          :font-weight="styles.transFontWeight"
          :phase="caption.phase"
          @lines-change="updateMeasurement(caption.captionId, 'translation', $event)"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowReactive, watch } from 'vue'
import type { CaptionItem, Styles } from '../../../../shared/types'
import {
  buildRollingCaptionTracks,
  selectRollingCaptionLines,
  type CaptionLineKind,
  type CaptionLineMeasurement
} from '../../captions/rollingLines'
import ExactCaptionText from './ExactCaptionText.vue'

const props = withDefaults(defineProps<{
  captions: CaptionItem[]
  fallbackCaptions?: CaptionItem[]
  styles: Styles
  draggable?: boolean
}>(), {
  fallbackCaptions: () => [],
  draggable: false
})

const measurements = shallowReactive(
  new Map<string, CaptionLineMeasurement>()
)

const sourceCaptions = computed(() => {
  return props.captions.length > 0 ? props.captions : props.fallbackCaptions
})

const measuredCaptions = computed(() => {
  const measurementCount = Math.max(props.styles.lineNumber + 2, 4)
  return sourceCaptions.value.slice(-measurementCount)
})

watch(
  () => measuredCaptions.value.map(caption => caption.captionId),
  captionIds => {
    const activeIds = new Set(captionIds)
    for (const captionId of measurements.keys()) {
      if (!activeIds.has(captionId)) measurements.delete(captionId)
    }
  },
  { immediate: true }
)

const rollingTracks = computed(() => buildRollingCaptionTracks(
  measuredCaptions.value,
  measurements,
  props.styles.transDisplay
))

const visibleSourceRows = computed(() => selectRollingCaptionLines(
  rollingTracks.value.source,
  props.styles.lineNumber
))

const visibleTranslationRows = computed(() => selectRollingCaptionLines(
  rollingTracks.value.translation,
  props.styles.lineNumber
))

const viewportStyle = computed(() => ({
  textShadow: props.styles.textShadow
    ? `${props.styles.offsetX}px ${props.styles.offsetY}px ${props.styles.blur}px ${props.styles.textShadowColor}`
    : 'none'
}))

function updateMeasurement(
  captionId: string,
  kind: CaptionLineKind,
  lines: string[]
): void {
  const current = measurements.get(captionId) ?? {
    source: [],
    translation: []
  }
  measurements.set(captionId, {
    ...current,
    [kind]: [...lines]
  })
}

function lineStyle(kind: CaptionLineKind): Record<string, string | number> {
  const translated = kind === 'translation'
  return {
    fontFamily: translated
      ? props.styles.transFontFamily
      : props.styles.fontFamily,
    fontSize: `${translated
      ? props.styles.transFontSize
      : props.styles.fontSize}px`,
    color: translated
      ? props.styles.transFontColor
      : props.styles.fontColor,
    fontWeight: (translated
      ? props.styles.transFontWeight
      : props.styles.fontWeight) * 100
  }
}
</script>

<style scoped>
.rolling-caption-viewport {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.rolling-caption-viewport.draggable {
  -webkit-app-region: drag;
}

.rolling-line-list {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.rolling-line {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  line-height: 1.6em;
  text-align: left;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: normal;
  line-break: auto;
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

.rolling-measurements {
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
