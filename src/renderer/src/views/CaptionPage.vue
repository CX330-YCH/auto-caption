<template>
  <div
    ref="caption"
    class="caption-page"
    :style="{ backgroundColor: captionStyle.backgroundRGBA }"
    @pointerenter="revealToolbar"
    @pointermove="revealToolbar"
    @pointerleave="scheduleToolbarHide"
  >
    <CaptionViewport
      :captions="captionData"
      :fallback-captions="fallbackCaptions"
      :styles="captionStyle.captionConfig.styles"
      draggable
    />

    <div
      class="caption-toolbar"
      :class="{ visible: toolbarVisible }"
      @pointerenter="onToolbarEnter"
      @pointerleave="onToolbarLeave"
      @focusin="onToolbarEnter"
      @focusout="onToolbarFocusOut"
    >
      <button
        type="button"
        class="toolbar-button"
        :title="$t('captionToolbar.close')"
        :aria-label="$t('captionToolbar.close')"
        @click="closeCaptionWindow"
      >
        <CloseOutlined />
      </button>
      <button
        type="button"
        class="toolbar-button"
        :title="$t('captionToolbar.settings')"
        :aria-label="$t('captionToolbar.settings')"
        @click="openControlWindow"
      >
        <SettingOutlined />
      </button>
      <button
        type="button"
        class="toolbar-button"
        :title="pinned
          ? $t('captionToolbar.disableClickThrough')
          : $t('captionToolbar.enableClickThrough')"
        :aria-label="pinned
          ? $t('captionToolbar.disableClickThrough')
          : $t('captionToolbar.enableClickThrough')"
        @click="pinCaptionWindow"
      >
        <PushpinFilled v-if="pinned" />
        <PushpinOutlined v-else />
      </button>
      <div class="drag-area"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  PushpinOutlined,
  PushpinFilled,
  CloseOutlined,
  SettingOutlined
} from '@ant-design/icons-vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import type { CaptionItem } from '../../../shared/types'
import CaptionViewport from '@renderer/components/caption/CaptionViewport.vue'
import { useCaptionStyleStore } from '@renderer/stores/captionStyle'
import { useCaptionLogStore } from '@renderer/stores/captionLog'

const TOOLBAR_HIDE_DELAY_MS = 900

const { t } = useI18n()
const captionStyle = useCaptionStyleStore()
const captionLog = useCaptionLogStore()
const { captionData } = storeToRefs(captionLog)
const caption = ref<HTMLElement>()
const windowHeight = ref(100)
const pinned = ref(false)
const toolbarVisible = ref(true)
const toolbarInteractive = ref(false)
let toolbarHideTimer: ReturnType<typeof setTimeout> | undefined
let resizeObserver: ResizeObserver | undefined

const fallbackCaptions = computed<CaptionItem[]>(() =>
  Array.from({ length: 4 }, (_, index) => ({
    captionId: `preview:${index}`,
    index: index + 1,
    time_s: '',
    time_t: '',
    text: t('example.original'),
    translation: t('example.translation'),
    phase: 'final'
  }))
)

function clearToolbarHideTimer(): void {
  if (toolbarHideTimer !== undefined) {
    clearTimeout(toolbarHideTimer)
    toolbarHideTimer = undefined
  }
}

function revealToolbar(): void {
  toolbarVisible.value = true
  clearToolbarHideTimer()
  if (!toolbarInteractive.value) scheduleToolbarHide()
}

function scheduleToolbarHide(): void {
  clearToolbarHideTimer()
  if (toolbarInteractive.value) return
  toolbarHideTimer = setTimeout(() => {
    toolbarVisible.value = false
    toolbarHideTimer = undefined
  }, TOOLBAR_HIDE_DELAY_MS)
}

function setMouseEventsIgnored(ignore: boolean): void {
  window.electron.ipcRenderer.send('caption.mouseEvents.ignore', ignore)
}

function onToolbarEnter(): void {
  toolbarInteractive.value = true
  toolbarVisible.value = true
  clearToolbarHideTimer()
  if (pinned.value) setMouseEventsIgnored(false)
}

function onToolbarLeave(): void {
  toolbarInteractive.value = false
  if (pinned.value) setMouseEventsIgnored(true)
  scheduleToolbarHide()
}

function onToolbarFocusOut(event: FocusEvent): void {
  const toolbar = event.currentTarget as HTMLElement
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && toolbar.contains(nextTarget)) return
  onToolbarLeave()
}

function pinCaptionWindow(): void {
  pinned.value = !pinned.value
  setMouseEventsIgnored(pinned.value && !toolbarInteractive.value)
}

function openControlWindow(): void {
  window.electron.ipcRenderer.send('caption.controlWindow.activate')
}

function closeCaptionWindow(): void {
  window.electron.ipcRenderer.send('caption.window.close')
}

onMounted(() => {
  resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const nextHeight = Math.floor(entry.contentRect.height) + 2
      if (windowHeight.value === nextHeight) continue
      windowHeight.value = nextHeight
      window.electron.ipcRenderer.send(
        'caption.windowHeight.change',
        windowHeight.value
      )
    }
  })
  if (caption.value) resizeObserver.observe(caption.value)
  scheduleToolbarHide()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  clearToolbarHideTimer()
  if (pinned.value) setMouseEventsIgnored(false)
})
</script>

<style scoped>
.caption-page {
  position: relative;
  box-sizing: border-box;
  display: flex;
  width: 100%;
  overflow: hidden;
  user-select: none;
  border: 1px solid #3333;
  border-radius: 8px;
}

.caption-toolbar {
  position: absolute;
  z-index: 2;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  width: 40px;
  flex-direction: column;
  color: v-bind('captionStyle.fontColor');
  opacity: 0;
  pointer-events: none;
  transform: translateX(6px);
  background: linear-gradient(90deg, transparent, rgb(0 0 0 / 28%));
  transition: opacity 180ms ease, transform 180ms ease;
  -webkit-app-region: no-drag;
}

.caption-toolbar.visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
}

.toolbar-button {
  display: flex;
  width: 40px;
  height: 32px;
  padding: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  color: inherit;
  cursor: pointer;
  background: transparent;
  -webkit-app-region: no-drag;
}

.toolbar-button:hover,
.toolbar-button:focus-visible {
  outline: none;
  background-color: rgb(34 34 34 / 18%);
}

.drag-area {
  flex-grow: 1;
  -webkit-app-region: drag;
}
</style>
