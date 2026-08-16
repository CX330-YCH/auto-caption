<template>
  <a-card size="small" :title="$t('style.title')">
    <template #extra>
      <a @click="applyStyle">{{ $t('style.applyStyle') }}</a> |
      <a @click="backStyle">{{ $t('style.cancelChange') }}</a> |
      <a @click="resetStyle">{{ $t('style.resetStyle') }}</a>
    </template>

    <div class="input-item">
      <span class="input-label">{{ $t('style.displayMode') }}</span>
      <a-radio-group
        v-model:value="currentDisplayMode"
        class="responsive-radio-group"
      >
        <a-radio-button value="static">
          {{ $t('style.displayModes.static') }}
        </a-radio-button>
        <a-radio-button value="rolling">
          {{ $t('style.displayModes.rolling') }}
        </a-radio-button>
      </a-radio-group>
    </div>

    <div class="input-item">
      <span class="input-label">{{ $t('style.lineNumber') }}</span>
      <a-radio-group v-model:value="currentLineNumber" class="responsive-radio-group">
        <a-radio-button :value="1">1</a-radio-button>
        <a-radio-button :value="2">2</a-radio-button>
        <a-radio-button :value="3">3</a-radio-button>
        <a-radio-button :value="4">4</a-radio-button>
      </a-radio-group>
    </div>

    <div class="input-item">
      <span class="input-label">{{ $t('style.longCaption') }}</span>
      <a-select
        class="input-area"
        v-model:value="currentLineBreak"
        :disabled="currentDisplayMode === 'rolling'"
        :options="captionStyle.iBreakOptions"
      ></a-select>
    </div>
    <div v-if="currentDisplayMode === 'rolling'" class="mode-note">
      {{ $t('style.rollingWrapHint') }}
    </div>

    <div class="input-item">
      <span class="input-label">{{ $t('style.fontFamily') }}</span>
      <a-input
        class="input-area"
        v-model:value="currentFontFamily"
      />
    </div>

    <div class="input-item">
      <span class="input-label">{{ $t('style.fontColor') }}</span>
      <a-input
        class="input-area"
        type="color"
        v-model:value="currentFontColor"
      />
      <div class="input-item-value">{{ currentFontColor }}</div>
    </div>
    <div class="input-item">
      <span class="input-label">{{ $t('style.fontSize') }}</span>
      <a-slider
        class="input-area"
        :min="0" :max="72"
        v-model:value="currentFontSize"
      />
      <div class="input-item-value">{{ currentFontSize }}px</div>
    </div>
    <div class="input-item">
      <span class="input-label">{{ $t('style.fontWeight') }}</span>
      <a-slider
        class="input-area"
        :min="1" :max="9"
        v-model:value="currentFontWeight"
      />
      <div class="input-item-value">{{ currentFontWeight*100 }}</div>
    </div>
    <div class="input-item">
      <span class="input-label">{{ $t('style.background') }}</span>
      <a-input
        class="input-area"
        type="color"
        v-model:value="currentBackground"
      />
      <div class="input-item-value">{{ currentBackground }}</div>
    </div>
    <div class="input-item">
      <span class="input-label">{{ $t('style.opacity') }}</span>
      <a-slider
        class="input-area"
        :min="0"
        :max="100"
        v-model:value="currentOpacity"
      />
      <div class="input-item-value">{{ currentOpacity }}%</div>
    </div>

    <div class="switch-list">
      <div class="switch-option">
        <span class="switch-label">{{ $t('style.preview') }}</span>
        <a-switch v-model:checked="currentPreview" />
      </div>
      <div class="switch-option">
        <span class="switch-label">{{ $t('style.translation') }}</span>
        <a-switch v-model:checked="currentTransDisplay" />
      </div>
      <div class="switch-option">
        <span class="switch-label">{{ $t('style.textShadow') }}</span>
        <a-switch v-model:checked="currentTextShadow" />
      </div>
    </div>

    <div v-show="currentTransDisplay">
      <a-card size="small" :title="$t('style.trans.title')">
        <template #extra>
          <a @click="useSameStyle">{{ $t('style.trans.useSame') }}</a>
        </template>
        <div class="input-item">
          <span class="input-label">{{ $t('style.fontFamily') }}</span>
          <a-input
            class="input-area"
            v-model:value="currentTransFontFamily"
          />
        </div>
        <div class="input-item">
          <span class="input-label">{{ $t('style.fontColor') }}</span>
          <a-input
            class="input-area"
            type="color"
            v-model:value="currentTransFontColor"
          />
          <div class="input-item-value">{{ currentTransFontColor }}</div>
        </div>
        <div class="input-item">
          <span class="input-label">{{ $t('style.fontSize') }}</span>
          <a-slider
            class="input-area"
            :min="0" :max="72"
            v-model:value="currentTransFontSize"
          />
          <div class="input-item-value">{{ currentTransFontSize }}px</div>
        </div>
        <div class="input-item">
          <span class="input-label">{{ $t('style.fontWeight') }}</span>
          <a-slider
            class="input-area"
            :min="1" :max="9"
            v-model:value="currentTransFontWeight"
          />
          <div class="input-item-value">{{ currentTransFontWeight*100 }}</div>
        </div>
      </a-card>
    </div>

    <div v-show="currentTextShadow" style="margin-top:10px;">
      <a-card size="small" :title="$t('style.shadow.title')">
        <div class="input-item">
          <span class="input-label">{{ $t('style.shadow.offsetX') }}</span>
          <a-slider
            class="input-area"
            :min="-10" :max="10"
            v-model:value="currentOffsetX"
          />
          <div class="input-item-value">{{ currentOffsetX }}px</div>
        </div>
        <div class="input-item">
          <span class="input-label">{{ $t('style.shadow.offsetY') }}</span>
          <a-slider
            class="input-area"
            :min="-10" :max="10"
            v-model:value="currentOffsetY"
          />
          <div class="input-item-value">{{ currentOffsetY }}px</div>
        </div>
        <div class="input-item">
          <span class="input-label">{{ $t('style.shadow.blur') }}</span>
          <a-slider
            class="input-area"
            :min="0" :max="12"
            v-model:value="currentBlur"
          />
          <div class="input-item-value">{{ currentBlur }}px</div>
        </div>
        <div class="input-item">
          <span class="input-label">{{ $t('style.shadow.color') }}</span>
          <a-input
            class="input-area"
            type="color"
            v-model:value="currentTextShadowColor"
          />
          <div class="input-item-value">{{ currentTextShadowColor }}</div>
        </div>
      </a-card>
    </div>
  </a-card>

  <Teleport defer to="#caption-preview-host">
    <div
      v-if="currentPreview"
      class="preview-container"
      :style="{
        backgroundColor: addOpicityToColor(currentBackground, currentOpacity)
      }"
    >
      <CaptionViewport
        :captions="captionData"
        :fallback-captions="fallbackCaptions"
        :styles="previewStyles"
      />
    </div>
  </Teleport>

</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCaptionStyleStore } from '@renderer/stores/captionStyle'
import { storeToRefs } from 'pinia'
import { notification } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { useCaptionLogStore } from '@renderer/stores/captionLog'
import CaptionViewport from './caption/CaptionViewport.vue'
import type {
  CaptionDisplayMode,
  CaptionItem,
  Styles
} from '../../../shared/types'

const captionLog = useCaptionLogStore()
const { captionData } = storeToRefs(captionLog)

const { t } = useI18n()

const captionStyle = useCaptionStyleStore()
const { changeSignal } = storeToRefs(captionStyle)

const currentDisplayMode = ref<CaptionDisplayMode>('static')
const currentLineNumber = ref<number>(1)
const currentLineBreak = ref<number>(0)
const currentFontFamily = ref<string>('sans-serif')
const currentFontSize = ref<number>(24)
const currentFontColor = ref<string>('#000000')
const currentFontWeight = ref<number>(4)
const currentBackground = ref<string>('#dbe2ef')
const currentOpacity = ref<number>(50)
const currentPreview = ref<boolean>(true)
const currentTransDisplay = ref<boolean>(true)
const currentTransFontFamily = ref<string>('sans-serif')
const currentTransFontSize = ref<number>(24)
const currentTransFontColor = ref<string>('#000000')
const currentTransFontWeight = ref<number>(4)
const currentTextShadow = ref<boolean>(false)
const currentOffsetX = ref<number>(2)
const currentOffsetY = ref<number>(2)
const currentBlur = ref<number>(0)
const currentTextShadowColor = ref<string>('#ffffff')

const previewStyles = computed<Styles>(() => ({
  displayMode: currentDisplayMode.value,
  lineNumber: currentLineNumber.value,
  lineBreak: currentLineBreak.value,
  fontFamily: currentFontFamily.value,
  fontSize: currentFontSize.value,
  fontColor: currentFontColor.value,
  fontWeight: currentFontWeight.value,
  background: currentBackground.value,
  opacity: currentOpacity.value,
  showPreview: currentPreview.value,
  transDisplay: currentTransDisplay.value,
  transFontFamily: currentTransFontFamily.value,
  transFontSize: currentTransFontSize.value,
  transFontColor: currentTransFontColor.value,
  transFontWeight: currentTransFontWeight.value,
  textShadow: currentTextShadow.value,
  offsetX: currentOffsetX.value,
  offsetY: currentOffsetY.value,
  blur: currentBlur.value,
  textShadowColor: currentTextShadowColor.value
}))

const fallbackCaptions = computed<CaptionItem[]>(() =>
  Array.from({ length: 4 }, (_, index) => ({
    captionId: `style-preview:${index}`,
    index: index + 1,
    time_s: '',
    time_t: '',
    text: t('example.original'),
    translation: t('example.translation'),
    phase: 'final'
  }))
)

function addOpicityToColor(color: string, opicity: number): string {
  const opicityValue = Math.round(opicity * 255 / 100)
  const opicityHex = opicityValue.toString(16).padStart(2, '0')
  return `${color}${opicityHex}`
}

function useSameStyle(): void {
  currentTransFontFamily.value = currentFontFamily.value
  currentTransFontSize.value = currentFontSize.value
  currentTransFontColor.value = currentFontColor.value
  currentTransFontWeight.value = currentFontWeight.value
}

function applyStyle(): void {
  captionStyle.displayMode = currentDisplayMode.value
  captionStyle.lineNumber = currentLineNumber.value
  captionStyle.lineBreak = currentLineBreak.value
  captionStyle.fontFamily = currentFontFamily.value
  captionStyle.fontSize = currentFontSize.value
  captionStyle.fontColor = currentFontColor.value
  captionStyle.fontWeight = currentFontWeight.value
  captionStyle.background = currentBackground.value
  captionStyle.opacity = currentOpacity.value
  captionStyle.showPreview = currentPreview.value
  captionStyle.transDisplay = currentTransDisplay.value
  captionStyle.transFontFamily = currentTransFontFamily.value
  captionStyle.transFontSize = currentTransFontSize.value
  captionStyle.transFontColor = currentTransFontColor.value
  captionStyle.transFontWeight = currentTransFontWeight.value
  captionStyle.textShadow = currentTextShadow.value
  captionStyle.offsetX = currentOffsetX.value
  captionStyle.offsetY = currentOffsetY.value
  captionStyle.blur = currentBlur.value
  captionStyle.textShadowColor = currentTextShadowColor.value

  captionStyle.sendCaptionConfigChange()

  notification.open({
    placement: 'topLeft',
    message: t('noti.styleChange'),
    description: t('noti.styleInfo')
  })
}

function backStyle(): void {
  currentDisplayMode.value = captionStyle.displayMode
  currentLineNumber.value = captionStyle.lineNumber
  currentLineBreak.value = captionStyle.lineBreak
  currentFontFamily.value = captionStyle.fontFamily
  currentFontSize.value = captionStyle.fontSize
  currentFontColor.value = captionStyle.fontColor
  currentFontWeight.value = captionStyle.fontWeight
  currentBackground.value = captionStyle.background
  currentOpacity.value = captionStyle.opacity
  currentPreview.value = captionStyle.showPreview
  currentTransDisplay.value = captionStyle.transDisplay
  currentTransFontFamily.value = captionStyle.transFontFamily
  currentTransFontSize.value = captionStyle.transFontSize
  currentTransFontColor.value = captionStyle.transFontColor
  currentTransFontWeight.value = captionStyle.transFontWeight
  currentTextShadow.value = captionStyle.textShadow
  currentOffsetX.value = captionStyle.offsetX
  currentOffsetY.value = captionStyle.offsetY
  currentBlur.value = captionStyle.blur
  currentTextShadowColor.value = captionStyle.textShadowColor
}

function resetStyle(): void {
  captionStyle.resetCaptionConfig()
}

watch(changeSignal, (val): void => {
  if(val === true) {
    backStyle()
    captionStyle.changeSignal = false
  }
})
</script>

<style scoped>
@import url(../assets/input.css);
.general-note {
  padding: 10px 10px 0;
  max-width: min(36vw, 400px);
}

.hover-label {
  color: #1668dc;
  cursor: pointer;
  font-weight: bold;
}

.mode-note {
  margin: -4px 0 12px;
  color: #888;
  font-size: 12px;
}

.switch-option {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(112px, 128px) auto;
  align-items: center;
  justify-content: start;
  column-gap: 12px;
}

.switch-list {
  display: grid;
  row-gap: 10px;
  margin: 12px 0;
}

.preview-container {
  box-sizing: border-box;
  width: 100%;
  text-align: center;
  padding: 10px;
  border-radius: 10px;
  overflow-wrap: anywhere;
}

</style>
