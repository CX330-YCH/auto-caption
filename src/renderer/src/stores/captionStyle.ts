import { computed, reactive, ref, toRaw, toRefs } from 'vue'
import { defineStore } from 'pinia'
import type { CaptionConfig } from '../../../shared/config/schema'
import { createDefaultConfig } from '../../../shared/config/schema'
import { breakOptions } from '@renderer/i18n'

export const useCaptionStyleStore = defineStore('captionStyle', () => {
  const captionConfig = reactive<CaptionConfig>(
    createDefaultConfig('').caption
  )
  const {
    lineNumber,
    lineBreak,
    fontFamily,
    fontSize,
    fontColor,
    fontWeight,
    background,
    opacity,
    showPreview,
    transDisplay,
    transFontFamily,
    transFontSize,
    transFontColor,
    transFontWeight,
    textShadow,
    offsetX,
    offsetY,
    blur,
    textShadowColor
  } = toRefs(captionConfig.styles)

  const iBreakOptions = ref(breakOptions.zh)
  const changeSignal = ref(false)

  function addOpacityToColor(color: string, opacityValue: number): string {
    const alphaValue = Math.round(opacityValue * 255 / 100)
    const alphaHex = alphaValue.toString(16).padStart(2, '0')
    return `${color}${alphaHex}`
  }

  const backgroundRGBA = computed(() => {
    return addOpacityToColor(background.value, opacity.value)
  })

  function sendCaptionConfigChange(): void {
    window.electron.ipcRenderer.send(
      'control.captionConfig.change',
      toRaw(captionConfig)
    )
  }

  function resetCaptionConfig(): void {
    window.electron.ipcRenderer.send('control.captionConfig.reset')
  }

  function setCaptionConfig(value: CaptionConfig): void {
    const { styles, ...caption } = value
    Object.assign(captionConfig, caption)
    Object.assign(captionConfig.styles, styles)
    changeSignal.value = true
  }

  window.electron.ipcRenderer.on(
    'both.captionConfig.set',
    (_, value: CaptionConfig) => setCaptionConfig(value)
  )

  return {
    captionConfig,
    lineNumber,
    lineBreak,
    fontFamily,
    fontSize,
    fontColor,
    fontWeight,
    background,
    opacity,
    showPreview,
    transDisplay,
    transFontFamily,
    transFontSize,
    transFontColor,
    transFontWeight,
    textShadow,
    offsetX,
    offsetY,
    blur,
    textShadowColor,
    backgroundRGBA,
    setCaptionConfig,
    sendCaptionConfigChange,
    resetCaptionConfig,
    iBreakOptions,
    changeSignal
  }
})
