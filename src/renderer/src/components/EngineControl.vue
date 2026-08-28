<template>
  <div style="height: 20px"></div>
  <a-card size="small" :title="$t('engine.title')">
    <template #extra>
      <a @click="applyChange">{{ $t('engine.applyChange') }}</a> |
      <a @click="cancelChange">{{ $t('engine.cancelChange') }}</a>
    </template>

    <SettingsForm>
      <EngineSelector
        v-model="draft.activeEngineId"
        :builtin-options="builtinEngineOptions"
        :custom-engines="draft.customEngines"
        @add="openCustomEngineDialog"
        @delete="deleteCustomEngine"
        @unavailable="showUnavailableEngineReason"
      />
    </SettingsForm>

    <template v-if="activeBuiltinProvider">
      <SettingsForm>
        <EngineFieldRenderer
          v-for="field in primaryFields"
          :key="field.id"
          :field="field"
          :model-value="fieldValue(field)"
          :accent-color="uiColor"
          @update:model-value="updateField(field, $event)"
          @browse="selectFolderPath(field)"
        />

        <SettingsField
          v-if="translationSettingsAvailable"
          :label="$t('engine.configureTranslation')"
          kind="switch"
          control-layout="intrinsic"
        >
          <a-switch v-model:checked="showTranslationSettings" />
        </SettingsField>
      </SettingsForm>

      <a-card
        v-show="translationSettingsAvailable && showTranslationSettings"
        size="small"
        :title="$t('engine.translationSettings')"
      >
        <SettingsForm>
          <EngineFieldRenderer
            v-for="field in translationFields"
            :key="field.id"
            :field="field"
            :model-value="fieldValue(field)"
            :accent-color="uiColor"
            @update:model-value="updateField(field, $event)"
          />
        </SettingsForm>
      </a-card>
    </template>

    <AppleSpeechModelManager
      v-if="activeBuiltinProvider === 'apple_speech'"
      :locale="draft.common.sourceLanguage"
    />

    <a-card v-if="activeCustomEngine" size="small" :title="activeCustomEngine.name">
      <template #extra>
        <a-popover>
          <template #content>
            <p class="customize-note">{{ $t('engine.custom.note') }}</p>
          </template>
          <a><InfoCircleOutlined />{{ $t('engine.custom.attention') }}</a>
        </a-popover>
      </template>
      <SettingsForm>
        <SettingsField :label="$t('engine.custom.app')">
          <a-input v-model:value="activeCustomEngine.executable" />
        </SettingsField>
        <SettingsField :label="$t('engine.custom.command')">
          <a-input v-model:value="activeCustomEngine.command" />
        </SettingsField>
      </SettingsForm>
    </a-card>

    <SettingsForm>
      <SettingsField :label="$t('engine.showMore')" kind="switch" control-layout="intrinsic">
        <a-switch v-model:checked="showMore" />
      </SettingsField>
    </SettingsForm>

    <a-card size="small" :title="$t('engine.showMore')" v-show="showMore" style="margin-top: 10px">
      <SettingsForm>
        <EngineFieldRenderer
          v-for="field in advancedFields"
          :key="field.id"
          :field="field"
          :model-value="fieldValue(field)"
          :accent-color="uiColor"
          @update:model-value="updateField(field, $event)"
          @browse="selectFolderPath(field)"
        />
        <SettingsField v-if="activeCustomEngine" :label="$t('engine.startTimeout')">
          <a-input-number
            v-model:value="draft.common.startTimeoutSeconds"
            :min="10"
            :max="120"
            :step="5"
            :addon-after="$t('engine.seconds')"
          />
        </SettingsField>
      </SettingsForm>
      <HotwordManager
        v-if="hotwordManagerEnabled"
        id="fun-asr-hotwords"
        :model-value="draft.providers.funAsr.hotwords"
        :applied-model="engineControl.engineConfig.providers.funAsr.model"
        :applied-workspace-id="engineControl.engineConfig.providers.funAsr.workspaceId"
        :applied-websocket-url="engineControl.engineConfig.providers.funAsr.websocketUrl"
        @update:model-value="draft.providers.funAsr.hotwords = $event"
      />
    </a-card>
  </a-card>
  <a-modal
    v-model:open="customEngineDialogOpen"
    :title="$t('engine.custom.namePrompt')"
    :ok-text="$t('engine.custom.create')"
    :cancel-text="$t('engine.cancelChange')"
    @ok="createCustomEngine"
  >
    <a-input
      v-model:value="customEngineName"
      :maxlength="64"
      :placeholder="$t('engine.custom.namePlaceholder')"
      @press-enter="createCustomEngine"
    />
    <p v-if="customEngineNameError" class="name-error">{{ customEngineNameError }}</p>
  </a-modal>
  <div style="height: 20px"></div>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { notification } from 'ant-design-vue'
import { ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import EngineFieldRenderer from '@renderer/components/engine/EngineFieldRenderer.vue'
import EngineSelector from '@renderer/components/engine/EngineSelector.vue'
import HotwordManager from '@renderer/components/engine/HotwordManager.vue'
import AppleSpeechModelManager from '@renderer/components/engine/AppleSpeechModelManager.vue'
import SettingsField from '@renderer/components/settings/SettingsField.vue'
import SettingsForm from '@renderer/components/settings/SettingsForm.vue'
import {
  applyEngineLanguageDefaults,
  getEngineDefinition,
  getEngineFields,
  getEngineOptions,
  getTranslationFields,
  normalizeEngineConfig,
  validateEngineConfig
} from '@renderer/engines/catalog.ts'
import {
  cloneEngineConfig,
  getEngineConfigValue,
  isEngineFieldVisible,
  setEngineConfigValue
} from '@renderer/engines/form.ts'
import type { EngineFieldDescriptor } from '@renderer/engines/types.ts'
import { getActiveBuiltinProvider, getActiveCustomEngine } from '../../../shared/config/schema.ts'
import { useGeneralSettingStore } from '@renderer/stores/generalSetting'
import { useEngineControlStore } from '@renderer/stores/engineControl'
import { appleSpeechLocaleDisplayName } from '@renderer/engines/appleSpeechLocale.ts'
import {
  appleSpeechLocalesEqual,
  normalizeAppleSpeechLocale
} from '../../../shared/appleSpeech.ts'

const { t } = useI18n()
const showMore = ref(false)
const showTranslationSettings = ref(false)
const customEngineDialogOpen = ref(false)
const customEngineName = ref('')
const customEngineNameError = ref('')
const engineControl = useEngineControlStore()
const { changeSignal, appleSpeechAvailability } = storeToRefs(engineControl)
const generalSetting = useGeneralSettingStore()
const { uiColor, uiLanguage } = storeToRefs(generalSetting)
const draft = ref(cloneEngineConfig(engineControl.engineConfig))
let resettingDraft = false

const builtinEngineOptions = computed(() => {
  return getEngineOptions().flatMap((option) => {
    if (option.value !== 'apple_speech') return [option]
    if (engineControl.platform !== 'darwin') return []
    const availability = appleSpeechAvailability.value
    const reason = availability.reason ?? 'probe_failed'
    return [{
      ...option,
      disabled: availability.state !== 'available',
      disabledReasonKey: availability.state === 'available'
        ? undefined
        : `engine.appleSpeech.disabled.${reason}`
    }]
  })
})
const activeBuiltinProvider = computed(() => getActiveBuiltinProvider(draft.value))
const activeCustomEngine = computed(() => getActiveCustomEngine(draft.value))
const visibleFields = computed(() => {
  if (!activeBuiltinProvider.value) return []
  const definition = getEngineDefinition(activeBuiltinProvider.value)
  return [
    ...getEngineFields(activeBuiltinProvider.value),
    ...getTranslationFields(draft.value, definition)
  ]
    .filter((field) => isEngineFieldVisible(draft.value, field))
    .map((field) => {
      if (activeBuiltinProvider.value !== 'apple_speech' || field.id !== 'source-language') {
        return field
      }
      return {
        ...field,
        options: appleSpeechAvailability.value.supportedLocales.map((locale) => ({
          value: locale,
          label: appleSpeechLocaleDisplayName(locale, uiLanguage.value, t),
          labelKey: 'engine.appleSpeech.locale'
        }))
      }
    })
})
const primaryFields = computed(() =>
  visibleFields.value.filter((field) => field.section === 'primary')
)
const advancedFields = computed(() =>
  visibleFields.value.filter((field) => field.section === 'advanced')
)
const translationFields = computed(() =>
  visibleFields.value.filter((field) => field.section === 'translation')
)
const translationSettingsAvailable = computed(() => {
  if (!activeBuiltinProvider.value || !draft.value.translation.enabled) return false
  return getEngineDefinition(activeBuiltinProvider.value).capabilities.translation === 'external'
})
const hotwordManagerEnabled = computed(() => {
  return (
    activeBuiltinProvider.value !== null &&
    getEngineDefinition(activeBuiltinProvider.value).capabilities.hotwords === 'manager'
  )
})

function fieldValue(field: EngineFieldDescriptor): unknown {
  return getEngineConfigValue(draft.value, field.path)
}

function updateField(field: EngineFieldDescriptor, value: unknown): void {
  setEngineConfigValue(draft.value, field.path, value)
}

function applyChange(): void {
  normalizeEngineConfig(draft.value)
  const validationIssue = validateEngineConfig(draft.value, 'apply')
  if (validationIssue) {
    if (validationIssue.fieldId.startsWith('translation-')) {
      showTranslationSettings.value = true
    }
    notification.open({
      message: t(validationIssue.titleKey),
      description: t(validationIssue.descriptionKey),
      duration: null,
      icon: () => h(ExclamationCircleOutlined, { style: 'color: #ff4d4f' })
    })
    return
  }

  engineControl.engineConfig = cloneEngineConfig(draft.value)
  engineControl.sendEngineConfigChange()
  if (draft.value.activeEngineId === 'apple_speech') {
    void engineControl.checkAppleSpeechModel(draft.value.common.sourceLanguage)
  }
  notification.open({
    placement: 'topLeft',
    message: t('noti.engineChange'),
    description: t('noti.changeInfo')
  })
}

function showUnavailableEngineReason(reasonKey: string): void {
  notification.open({
    message: t('engine.appleSpeech.unavailableTitle'),
    description: t(reasonKey),
    duration: null,
    icon: () => h(ExclamationCircleOutlined, { style: 'color: #faad14' })
  })
}

function openCustomEngineDialog(): void {
  customEngineName.value = ''
  customEngineNameError.value = ''
  customEngineDialogOpen.value = true
}

function createCustomEngine(): void {
  const name = customEngineName.value.trim()
  if (!name) {
    customEngineNameError.value = t('engine.custom.nameRequired')
    return
  }
  if (
    draft.value.customEngines.some(
      (engine) => engine.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    )
  ) {
    customEngineNameError.value = t('engine.custom.nameDuplicate')
    return
  }
  const id = `custom-${crypto.randomUUID()}`
  draft.value.customEngines.push({ id, name, executable: '', command: '' })
  draft.value.activeEngineId = id
  customEngineDialogOpen.value = false
}

function deleteCustomEngine(id: string): void {
  draft.value.customEngines = draft.value.customEngines.filter((engine) => engine.id !== id)
  if (draft.value.activeEngineId === id) draft.value.activeEngineId = 'gummy'
}

function cancelChange(): void {
  resettingDraft = true
  draft.value = cloneEngineConfig(engineControl.engineConfig)
  resettingDraft = false
}

function selectFolderPath(field: EngineFieldDescriptor): void {
  if (field.control !== 'directory') return
  window.electron.ipcRenderer.invoke('control.folder.select').then((folderPath) => {
    if (folderPath) setEngineConfigValue(draft.value, field.path, folderPath)
  })
}

watch(changeSignal, (changed) => {
  if (!changed) return
  cancelChange()
  engineControl.changeSignal = false
})

watch(
  () => draft.value.activeEngineId,
  () => {
    if (resettingDraft) return
    showTranslationSettings.value = false
    const provider = getActiveBuiltinProvider(draft.value)
    if (provider) applyEngineLanguageDefaults(draft.value, provider, uiLanguage.value)
    if (provider === 'apple_speech') {
      void engineControl.refreshAppleSpeechAvailability().then((availability) => {
        if (availability.state === 'available') {
          const matchingLocale = availability.supportedLocales.find((locale) =>
            appleSpeechLocalesEqual(locale, draft.value.common.sourceLanguage)
          )
          draft.value.common.sourceLanguage = matchingLocale ??
            availability.supportedLocales[0] ??
            normalizeAppleSpeechLocale(draft.value.common.sourceLanguage)
        }
        return engineControl.checkAppleSpeechModel(draft.value.common.sourceLanguage)
      })
    }
  },
  { flush: 'sync' }
)

watch(
  () => engineControl.platform,
  (platform) => {
    if (platform === 'darwin') void engineControl.refreshAppleSpeechAvailability()
  },
  { immediate: true }
)
</script>

<style scoped>
.customize-note {
  padding: 10px 10px 0;
  max-width: min(40vw, 480px);
}

.name-error {
  margin-top: 8px;
  color: #ff4d4f;
}
</style>
