<template>
  <div
    class="caption-viewport"
    :class="{ draggable }"
    :style="viewportStyle"
  >
    <RollingCaptionViewport
      v-if="styles.displayMode === 'rolling'"
      :captions="captions"
      :fallback-captions="fallbackCaptions"
      :styles="styles"
      :draggable="draggable"
    />
    <template v-else v-for="caption in visibleCaptions" :key="caption.captionId">
      <ExactCaptionText
        :text="caption.text"
        :wrap="Boolean(styles.lineBreak)"
        :font-family="styles.fontFamily"
        :font-size="styles.fontSize"
        :font-color="styles.fontColor"
        :font-weight="styles.fontWeight"
        :phase="caption.phase"
      />
      <ExactCaptionText
        v-if="styles.transDisplay && caption.translation"
        :text="caption.translation"
        :wrap="Boolean(styles.lineBreak)"
        :font-family="styles.transFontFamily"
        :font-size="styles.transFontSize"
        :font-color="styles.transFontColor"
        :font-weight="styles.transFontWeight"
        :phase="caption.phase"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CaptionItem, Styles } from '../../../../shared/types'
import ExactCaptionText from './ExactCaptionText.vue'
import RollingCaptionViewport from './RollingCaptionViewport.vue'

const props = withDefaults(defineProps<{
  captions: CaptionItem[]
  fallbackCaptions?: CaptionItem[]
  styles: Styles
  draggable?: boolean
}>(), {
  fallbackCaptions: () => [],
  draggable: false
})

const visibleCaptions = computed(() => {
  const source = props.captions.length > 0
    ? props.captions
    : props.fallbackCaptions
  return source.slice(-props.styles.lineNumber)
})

const viewportStyle = computed(() => ({
  textShadow: props.styles.textShadow
    ? `${props.styles.offsetX}px ${props.styles.offsetY}px ${props.styles.blur}px ${props.styles.textShadowColor}`
    : 'none'
}))
</script>

<style scoped>
.caption-viewport {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 10px;
}

.caption-viewport.draggable {
  -webkit-app-region: drag;
}
</style>
