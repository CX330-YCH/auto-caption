import { reactive, ref, toRaw, toRefs, watch } from 'vue'
import { defineStore } from 'pinia'
import { i18n } from '../i18n'
import type { ApplicationConfig } from '../../../shared/config/schema'
import { createDefaultConfig } from '../../../shared/config/schema'

import { engines, audioTypes, breakOptions, setThemeColor, getTheme } from '../i18n'
import { useEngineControlStore } from './engineControl'
import { useCaptionStyleStore } from './captionStyle'

type RealTheme = 'light' | 'dark'

export const useGeneralSettingStore = defineStore('generalSetting', () => {
  const applicationConfig = reactive<ApplicationConfig>(
    createDefaultConfig('').application
  )
  const {
    language: uiLanguage,
    theme: uiTheme,
    accentColor: uiColor
  } = toRefs(applicationConfig)
  const { leftBarWidth } = toRefs(applicationConfig.layout)
  const realTheme = ref<RealTheme>('light')
  const antdTheme = ref(getTheme())

  function sendApplicationConfig(): void {
    window.electron.ipcRenderer.send(
      'control.application.change',
      toRaw(applicationConfig)
    )
  }

  function setApplicationConfig(value: ApplicationConfig): void {
    const { layout, ...application } = value
    Object.assign(applicationConfig, application)
    Object.assign(applicationConfig.layout, layout)
  }

  function handleThemeChange(newTheme: RealTheme): void {
    realTheme.value = newTheme
    if(newTheme === 'dark' && uiColor.value === '#000000') {
      uiColor.value = '#b9d7ea'
    }
    if(newTheme === 'light' && uiColor.value === '#b9d7ea') {
      uiColor.value = '#000000'
    }
  }

  window.electron.ipcRenderer.invoke('control.nativeTheme.get').then((theme) => {
    if(theme === 'light') setLightTheme()
    else if(theme === 'dark') setDarkTheme()
    handleThemeChange(theme)
  })

  watch(uiLanguage, (newValue) => {
    i18n.global.locale.value = newValue
    useEngineControlStore().captionEngine = engines[newValue]
    useEngineControlStore().audioType = audioTypes[newValue]
    useCaptionStyleStore().iBreakOptions = breakOptions[newValue]
    sendApplicationConfig()
  })

  watch(uiTheme, (newValue) => {
    sendApplicationConfig()
    if(newValue === 'system'){
      window.electron.ipcRenderer.invoke('control.nativeTheme.get').then((theme: RealTheme) => {
        if(theme === 'light') setLightTheme()
        else if(theme === 'dark') setDarkTheme()
        handleThemeChange(theme)
      })
    }
    else if(newValue === 'light'){
      setLightTheme()
      handleThemeChange('light')
    }
    else if(newValue === 'dark') {
      setDarkTheme()
      handleThemeChange('dark')
    }
  })

  watch(uiColor, (newValue) => {
    setThemeColor(newValue)
    antdTheme.value = getTheme()
    sendApplicationConfig()
  })

  watch(leftBarWidth, () => {
    sendApplicationConfig()
  })

  window.electron.ipcRenderer.on(
    'both.application.set',
    (_, value: ApplicationConfig) => setApplicationConfig(value)
  )

  window.electron.ipcRenderer.on('control.nativeTheme.change', (_, args: RealTheme) => {
    if(args === 'light') setLightTheme()
    else if(args === 'dark') setDarkTheme()
    handleThemeChange(args)
  })

  function setLightTheme(): void {
    antdTheme.value = getTheme(true)
    const root = document.documentElement
    root.style.setProperty('--control-background', '#fff')
    root.style.setProperty('--tag-color', 'rgba(0, 0, 0, 0.45)')
    root.style.setProperty('--icon-color', 'rgba(0, 0, 0, 0.88)')
  }

  function setDarkTheme(): void {
    antdTheme.value = getTheme(false)
    const root = document.documentElement
    root.style.setProperty('--control-background', '#000')
    root.style.setProperty('--tag-color', 'rgba(255, 255, 255, 0.45)')
    root.style.setProperty('--icon-color', 'rgba(255, 255, 255, 0.85)')
  }

  return {
    applicationConfig,
    setApplicationConfig,
    uiLanguage,
    realTheme,
    uiTheme,
    uiColor,
    leftBarWidth,
    antdTheme
  }
})
