<template>
  <a-card size="small" :title="$t('style.title')">
    <template #extra>
      <a @click="applyStyle">{{ $t('style.applyStyle') }}</a> |
      <a @click="backStyle">{{ $t('style.cancelChange') }}</a> |
      <a @click="resetStyle">{{ $t('style.resetStyle') }}</a>
    </template>

    <SettingsForm>
      <SettingsField :label="$t('style.displayMode')" control-layout="equal">
        <a-radio-group v-model:value="currentDisplayMode">
          <a-radio-button value="static">
            {{ $t('style.displayModes.static') }}
          </a-radio-button>
          <a-radio-button value="rolling">
            {{ $t('style.displayModes.rolling') }}
          </a-radio-button>
        </a-radio-group>
      </SettingsField>

      <SettingsField
        v-if="currentDisplayMode === 'rolling'"
        :label="$t('style.captionBoundaryMode')"
        control-layout="equal"
      >
        <a-radio-group v-model:value="currentCaptionBoundaryMode">
          <a-radio-button value="sentence">
            {{ $t('style.captionBoundaryModes.sentence') }}
          </a-radio-button>
          <a-radio-button value="continuous">
            {{ $t('style.captionBoundaryModes.continuous') }}
          </a-radio-button>
        </a-radio-group>
      </SettingsField>

      <SettingsField :label="$t('style.lineNumber')" control-layout="equal">
        <a-radio-group v-model:value="currentLineNumber">
          <a-radio-button :value="1">1</a-radio-button>
          <a-radio-button :value="2">2</a-radio-button>
          <a-radio-button :value="3">3</a-radio-button>
          <a-radio-button :value="4">4</a-radio-button>
        </a-radio-group>
      </SettingsField>

      <SettingsField :label="$t('style.longCaption')">
        <a-select
          v-model:value="currentLineBreak"
          :disabled="currentDisplayMode === 'rolling'"
          :options="captionStyle.iBreakOptions"
        ></a-select>
        <template v-if="currentDisplayMode === 'rolling'" #description>
          {{ $t('style.rollingWrapHint') }}
        </template>
      </SettingsField>

      <SettingsField :label="$t('style.fontFamily')" align="start">
        <FontFamilySelect v-model="currentFontFamily" @validity-change="sourceFontValid = $event" />
      </SettingsField>

      <SettingsField :label="$t('style.fontColor')">
        <a-input type="color" v-model:value="currentFontColor" />
        <template #value>{{ currentFontColor }}</template>
      </SettingsField>
      <SettingsField :label="$t('style.fontSize')">
        <a-slider :min="0" :max="72" v-model:value="currentFontSize" />
        <template #value>{{ currentFontSize }}px</template>
      </SettingsField>
      <SettingsField :label="$t('style.fontWeight')">
        <a-slider :min="1" :max="9" v-model:value="currentFontWeight" />
        <template #value>{{ currentFontWeight * 100 }}</template>
      </SettingsField>
      <SettingsField :label="$t('style.background')">
        <a-input type="color" v-model:value="currentBackground" />
        <template #value>{{ currentBackground }}</template>
      </SettingsField>
      <SettingsField :label="$t('style.opacity')">
        <a-slider :min="0" :max="100" v-model:value="currentOpacity" />
        <template #value>{{ currentOpacity }}%</template>
      </SettingsField>

      <SettingsField :label="$t('style.preview')" kind="switch" control-layout="intrinsic">
        <a-switch v-model:checked="currentPreview" />
      </SettingsField>
      <SettingsField :label="$t('style.translation')" kind="switch" control-layout="intrinsic">
        <a-switch v-model:checked="currentTransDisplay" />
      </SettingsField>
      <SettingsField :label="$t('style.textShadow')" kind="switch" control-layout="intrinsic">
        <a-switch v-model:checked="currentTextShadow" />
      </SettingsField>
    </SettingsForm>

    <div v-show="currentTransDisplay">
      <a-card size="small" :title="$t('style.trans.title')">
        <template #extra>
          <a @click="useSameStyle">{{ $t('style.trans.useSame') }}</a>
        </template>
        <SettingsForm>
          <SettingsField :label="$t('style.fontFamily')" align="start">
            <FontFamilySelect
              v-model="currentTransFontFamily"
              @validity-change="translationFontValid = $event"
            />
          </SettingsField>
          <SettingsField :label="$t('style.fontColor')">
            <a-input type="color" v-model:value="currentTransFontColor" />
            <template #value>{{ currentTransFontColor }}</template>
          </SettingsField>
          <SettingsField :label="$t('style.fontSize')">
            <a-slider :min="0" :max="72" v-model:value="currentTransFontSize" />
            <template #value>{{ currentTransFontSize }}px</template>
          </SettingsField>
          <SettingsField :label="$t('style.fontWeight')">
            <a-slider :min="1" :max="9" v-model:value="currentTransFontWeight" />
            <template #value>{{ currentTransFontWeight * 100 }}</template>
          </SettingsField>
        </SettingsForm>
      </a-card>
    </div>

    <div v-show="currentTextShadow" style="margin-top: 10px">
      <a-card size="small" :title="$t('style.shadow.title')">
        <SettingsForm>
          <SettingsField :label="$t('style.shadow.offsetX')">
            <a-slider :min="-10" :max="10" v-model:value="currentOffsetX" />
            <template #value>{{ currentOffsetX }}px</template>
          </SettingsField>
          <SettingsField :label="$t('style.shadow.offsetY')">
            <a-slider :min="-10" :max="10" v-model:value="currentOffsetY" />
            <template #value>{{ currentOffsetY }}px</template>
          </SettingsField>
          <SettingsField :label="$t('style.shadow.blur')">
            <a-slider :min="0" :max="12" v-model:value="currentBlur" />
            <template #value>{{ currentBlur }}px</template>
          </SettingsField>
          <SettingsField :label="$t('style.shadow.color')">
            <a-input type="color" v-model:value="currentTextShadowColor" />
            <template #value>{{ currentTextShadowColor }}</template>
          </SettingsField>
        </SettingsForm>
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
import FontFamilySelect from './FontFamilySelect.vue'
import CaptionViewport from './caption/CaptionViewport.vue'
import SettingsField from '@renderer/components/settings/SettingsField.vue'
import SettingsForm from '@renderer/components/settings/SettingsForm.vue'
import type {
  CaptionBoundaryMode,
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
const currentCaptionBoundaryMode = ref<CaptionBoundaryMode>('sentence')
const currentLineNumber = ref<number>(1)
const currentLineBreak = ref<number>(0)
const currentFontFamily = ref<string>('sans-serif')
const sourceFontValid = ref(true)
const currentFontSize = ref<number>(24)
const currentFontColor = ref<string>('#000000')
const currentFontWeight = ref<number>(4)
const currentBackground = ref<string>('#dbe2ef')
const currentOpacity = ref<number>(50)
const currentPreview = ref<boolean>(true)
const currentTransDisplay = ref<boolean>(true)
const currentTransFontFamily = ref<string>('sans-serif')
const translationFontValid = ref(true)
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
  captionBoundaryMode: currentCaptionBoundaryMode.value,
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
  const opicityValue = Math.round((opicity * 255) / 100)
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
  if (!sourceFontValid.value || !translationFontValid.value) {
    notification.error({
      placement: 'topLeft',
      message: t('style.fontPicker.invalidTitle'),
      description: t('style.fontPicker.invalidValue')
    })
    return
  }
  captionStyle.displayMode = currentDisplayMode.value
  captionStyle.captionBoundaryMode = currentCaptionBoundaryMode.value
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
  currentCaptionBoundaryMode.value = captionStyle.captionBoundaryMode
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
  if (val === true) {
    backStyle()
    captionStyle.changeSignal = false
  }
})
</script>

<style scoped>
.general-note {
  padding: 10px 10px 0;
  max-width: min(36vw, 400px);
}

.hover-label {
  color: #1668dc;
  cursor: pointer;
  font-weight: bold;
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
