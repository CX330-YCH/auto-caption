import { ref, toRaw } from 'vue'
import { defineStore } from 'pinia'

import { notification } from 'ant-design-vue'
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'
import { h } from 'vue'
import { useI18n } from 'vue-i18n'

import type { EngineConfig } from '../../../shared/config/schema'
import { createDefaultConfig } from '../../../shared/config/schema'
import { engines, audioTypes } from '@renderer/i18n'
import { useGeneralSettingStore } from './generalSetting'

export const useEngineControlStore = defineStore('engineControl', () => {
  const { t } = useI18n()
  const platform = ref('unknown')

  const captionEngine = ref(engines[useGeneralSettingStore().uiLanguage])
  const audioType = ref(audioTypes[useGeneralSettingStore().uiLanguage])
  const engineConfig = ref<EngineConfig>(createDefaultConfig('').engine)
  const engineEnabled = ref(false)
  const changeSignal = ref(false)
  const errorSignal = ref(false)

  function sendEngineConfigChange(): void {
    window.electron.ipcRenderer.send(
      'control.engineConfig.change',
      toRaw(engineConfig.value)
    )
  }

  function setEngineConfig(value: EngineConfig): void {
    engineConfig.value = value
    changeSignal.value = true
  }

  function emptyModelPathErr(): void {
    notification.open({
      message: t('noti.empty'),
      description: t('noti.emptyInfo'),
      duration: null,
      icon: () => h(ExclamationCircleOutlined, { style: 'color: #ff4d4f' })
    })
  }

  window.electron.ipcRenderer.on('control.engineState.set', (_, enabled: boolean) => {
    engineEnabled.value = enabled
  })

  window.electron.ipcRenderer.on('control.engine.started', (_, args) => {
    const config = engineConfig.value
    const common = config.common
    const str0 =
      `${t('noti.sLang')}${common.sourceLanguage}${t('noti.trans')}${common.translation.enabled?'yes':'no'}` +
      `${t('noti.engine')}${config.provider}${t('noti.audio')}${common.audioSource?t('noti.sysin'):t('noti.sysout')}` +
      (common.translation.enabled ? `${t('noti.tLang')}${common.targetLanguage}` : '')
    const str1 = `${t('noti.custom')}${config.custom.executable}${t('noti.args')}${config.custom.command}`
    notification.open({
      placement: 'topLeft',
      message: t('noti.started'),
      description:
        (config.custom.enabled ? str1 : str0) +
        `${t('noti.pidInfo')}${args}`
    })
  })

  window.electron.ipcRenderer.on('control.engine.stopped', () => {
    notification.open({
      placement: 'topLeft',
      message: t('noti.stopped'),
      description: t('noti.stoppedInfo')
    })
  })

  window.electron.ipcRenderer.on('control.error.occurred', (_, message) => {
    errorSignal.value = !errorSignal.value
    notification.open({
      message: t('noti.error'),
      description: message,
      duration: null,
      icon: () => h(ExclamationCircleOutlined, { style: 'color: #ff4d4f' })
    })
  })

  return {
    platform,
    captionEngine,
    audioType,
    engineConfig,
    engineEnabled,
    setEngineConfig,
    sendEngineConfigChange,
    emptyModelPathErr,
    changeSignal,
    errorSignal
  }
})
