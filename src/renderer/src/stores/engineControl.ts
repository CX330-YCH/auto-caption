import { ref, toRaw } from 'vue'
import { defineStore } from 'pinia'

import { notification } from 'ant-design-vue'
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'
import { h } from 'vue'
import { useI18n } from 'vue-i18n'

import type { EngineConfig } from '../../../shared/config/schema'
import type {
  AppleSpeechAvailability,
  AppleSpeechModelProgress,
  AppleSpeechModelStatus,
  AppleSpeechStartResult
} from '../../../shared/appleSpeech.ts'
import {
  appleSpeechLocalesEqual,
  normalizeAppleSpeechLocale
} from '../../../shared/appleSpeech.ts'
import { createDefaultConfig } from '../../../shared/config/schema'
import type { EngineValidationIssue } from '@renderer/engines/types.ts'
import {
  getActiveBuiltinProvider,
  getActiveCustomEngine
} from '../../../shared/config/schema.ts'

export const useEngineControlStore = defineStore('engineControl', () => {
  const { t } = useI18n()
  const platform = ref('unknown')

  const engineConfig = ref<EngineConfig>(createDefaultConfig('').engine)
  const engineEnabled = ref(false)
  const changeSignal = ref(false)
  const errorSignal = ref(false)
  const appleSpeechAvailability = ref<AppleSpeechAvailability>({
    state: 'hidden',
    supportedLocales: [],
    installedLocales: [],
    reservedLocales: [],
    maximumReservedLocales: 0
  })
  const appleSpeechModelStatus = ref<AppleSpeechModelStatus>({
    locale: '',
    state: 'unknown',
    systemInstalled: false,
    reservedLocales: [],
    maximumReservedLocales: 0
  })
  const appleSpeechModelDialogSignal = ref(0)
  let appleSpeechModelRequestSequence = 0

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

  function showConfigValidationError(issue: EngineValidationIssue): void {
    notification.open({
      message: t(issue.titleKey),
      description: t(issue.descriptionKey),
      duration: null,
      icon: () => h(ExclamationCircleOutlined, { style: 'color: #ff4d4f' })
    })
  }

  async function refreshAppleSpeechAvailability(
    force = false
  ): Promise<AppleSpeechAvailability> {
    const result = await window.electron.ipcRenderer.invoke(
      'control.appleSpeech.availability',
      force
    ) as AppleSpeechAvailability
    appleSpeechAvailability.value = result
    return result
  }

  async function checkAppleSpeechModel(
    locale: string
  ): Promise<AppleSpeechModelStatus> {
    const normalizedLocale = normalizeAppleSpeechLocale(locale)
    const requestSequence = ++appleSpeechModelRequestSequence
    appleSpeechModelStatus.value = {
      locale: normalizedLocale,
      state: 'checking',
      systemInstalled: appleSpeechAvailability.value.installedLocales.some(
        (installedLocale) => appleSpeechLocalesEqual(installedLocale, normalizedLocale)
      ),
      reservedLocales: appleSpeechModelStatus.value.reservedLocales,
      maximumReservedLocales: appleSpeechModelStatus.value.maximumReservedLocales
    }
    const result = await window.electron.ipcRenderer.invoke(
      'control.appleSpeech.modelStatus',
      normalizedLocale
    ) as AppleSpeechModelStatus
    if (
      requestSequence === appleSpeechModelRequestSequence &&
      appleSpeechLocalesEqual(result.locale, normalizedLocale)
    ) {
      appleSpeechModelStatus.value = result
    }
    return result
  }

  async function installAppleSpeechModel(locale: string): Promise<boolean> {
    const normalizedLocale = normalizeAppleSpeechLocale(locale)
    const result = await window.electron.ipcRenderer.invoke(
      'control.appleSpeech.installModel',
      normalizedLocale
    ) as { accepted: boolean; operationId?: string }
    if (result.accepted) {
      appleSpeechModelRequestSequence += 1
      appleSpeechModelStatus.value = {
        locale: normalizedLocale,
        state: 'downloading',
        systemInstalled: appleSpeechModelStatus.value.systemInstalled,
        reservedLocales: appleSpeechModelStatus.value.reservedLocales,
        maximumReservedLocales: appleSpeechModelStatus.value.maximumReservedLocales,
        fractionCompleted: 0
      }
    }
    return result.accepted
  }

  async function releaseAppleSpeechModel(locale: string): Promise<void> {
    const normalizedLocale = normalizeAppleSpeechLocale(locale)
    const result = await window.electron.ipcRenderer.invoke(
      'control.appleSpeech.releaseModel',
      normalizedLocale
    ) as AppleSpeechModelStatus
    if (appleSpeechLocalesEqual(appleSpeechModelStatus.value.locale, normalizedLocale)) {
      appleSpeechModelStatus.value = result
    }
    await refreshAppleSpeechAvailability(true)
    if (!appleSpeechLocalesEqual(appleSpeechModelStatus.value.locale, normalizedLocale)) {
      await checkAppleSpeechModel(appleSpeechModelStatus.value.locale)
    }
  }

  function applyAppleSpeechStartResult(result: AppleSpeechStartResult): void {
    if (result.availability) appleSpeechAvailability.value = result.availability
    if (result.modelStatus) appleSpeechModelStatus.value = result.modelStatus
    appleSpeechModelDialogSignal.value += 1
  }

  function openAppleSpeechModelDialog(): void {
    appleSpeechModelDialogSignal.value += 1
  }

  window.electron.ipcRenderer.on(
    'control.appleSpeech.modelProgress',
    (_, progress: AppleSpeechModelProgress) => {
      if (appleSpeechLocalesEqual(progress.locale, appleSpeechModelStatus.value.locale)) {
        appleSpeechModelStatus.value = progress
      }
      if (progress.state === 'installed') {
        void refreshAppleSpeechAvailability(true)
      }
    }
  )

  window.electron.ipcRenderer.on('control.engineState.set', (_, enabled: boolean) => {
    engineEnabled.value = enabled
  })

  window.electron.ipcRenderer.on('control.engine.started', (_, args) => {
    const config = engineConfig.value
    const common = config.common
    const provider = getActiveBuiltinProvider(config)
    const customEngine = getActiveCustomEngine(config)
    const str0 =
      `${t('noti.sLang')}${common.sourceLanguage}${t('noti.trans')}${common.translation.enabled?'yes':'no'}` +
      `${t('noti.engine')}${provider}${t('noti.audio')}${common.audioSource?t('noti.sysin'):t('noti.sysout')}` +
      (common.translation.enabled ? `${t('noti.tLang')}${common.targetLanguage}` : '')
    const str1 = customEngine
      ? `${t('noti.custom')}${customEngine.name} (${customEngine.executable})${t('noti.args')}${customEngine.command}`
      : ''
    notification.open({
      placement: 'topLeft',
      message: t('noti.started'),
      description:
        (customEngine ? str1 : str0) +
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
    engineConfig,
    engineEnabled,
    setEngineConfig,
    sendEngineConfigChange,
    showConfigValidationError,
    changeSignal,
    errorSignal,
    appleSpeechAvailability,
    appleSpeechModelStatus,
    appleSpeechModelDialogSignal,
    refreshAppleSpeechAvailability,
    checkAppleSpeechModel,
    installAppleSpeechModel,
    releaseAppleSpeechModel,
    applyAppleSpeechStartResult,
    openAppleSpeechModelDialog
  }
})
