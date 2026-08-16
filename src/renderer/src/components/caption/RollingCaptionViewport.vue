<template>
  <div
    class="rolling-caption-viewport"
    :class="{ draggable }"
    :style="viewportStyle"
  >
    <RollingCaptionTrack
      kind="source"
      :segments="sourceSegments"
      :boundary-mode="styles.captionBoundaryMode"
      :line-number="styles.lineNumber"
      :font-family="styles.fontFamily"
      :font-size="styles.fontSize"
      :font-color="styles.fontColor"
      :font-weight="styles.fontWeight"
    />
    <RollingCaptionTrack
      v-if="styles.transDisplay"
      kind="translation"
      :segments="translationSegments"
      :boundary-mode="styles.captionBoundaryMode"
      :line-number="styles.lineNumber"
      :font-family="styles.transFontFamily"
      :font-size="styles.transFontSize"
      :font-color="styles.transFontColor"
      :font-weight="styles.transFontWeight"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CaptionItem, Styles } from '../../../../shared/types'
import { buildCaptionTrackSegments } from '../../captions/captionTracks'
import RollingCaptionTrack from './RollingCaptionTrack.vue'

const props = withDefaults(defineProps<{
  captions: CaptionItem[]
  fallbackCaptions?: CaptionItem[]
  styles: Styles
  draggable?: boolean
}>(), {
  fallbackCaptions: () => [],
  draggable: false
})

const sourceCaptions = computed(() => {
  return props.captions.length > 0 ? props.captions : props.fallbackCaptions
})

const sourceSegments = computed(() => buildCaptionTrackSegments(
  sourceCaptions.value,
  'source'
))

const translationSegments = computed(() => buildCaptionTrackSegments(
  sourceCaptions.value,
  'translation'
))

const viewportStyle = computed(() => ({
  textShadow: props.styles.textShadow
    ? `${props.styles.offsetX}px ${props.styles.offsetY}px ${props.styles.blur}px ${props.styles.textShadowColor}`
    : 'none'
}))
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

</style>
