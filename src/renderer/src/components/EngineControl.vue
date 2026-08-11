<template>
  <div style="height: 20px"></div>
  <a-card size="small" :title="$t('engine.title')">
    <template #extra>
      <a @click="applyChange">{{ $t('engine.applyChange') }}</a> |
      <a @click="cancelChange">{{ $t('engine.cancelChange') }}</a>
    </template>

    <EngineFieldRenderer
      v-for="field in primaryFields"
      :key="field.id"
      :field="field"
      :model-value="fieldValue(field)"
      :accent-color="uiColor"
      @update:model-value="updateField(field, $event)"
      @browse="selectFolderPath(field)"
    />

    <div class="input-item">
      <span class="input-label">{{ $t('engine.showMore') }}</span>
      <a-switch v-model:checked="showMore" />
    </div>

    <a-card size="small" :title="$t('engine.custom.title')" v-show="draft.custom.enabled">
      <template #extra>
        <a-popover>
          <template #content>
            <p class="customize-note">{{ $t('engine.custom.note') }}</p>
          </template>
          <a><InfoCircleOutlined />{{ $t('engine.custom.attention') }}</a>
        </a-popover>
      </template>
      <EngineFieldRenderer
        v-for="field in customFields"
        :key="field.id"
        :field="field"
        :model-value="fieldValue(field)"
        :accent-color="uiColor"
        @update:model-value="updateField(field, $event)"
        @browse="selectFolderPath(field)"
      />
    </a-card>

    <a-card size="small" :title="$t('engine.showMore')" v-show="showMore" style="margin-top: 10px">
      <EngineFieldRenderer
        v-for="field in advancedFields"
        :key="field.id"
        :field="field"
        :model-value="fieldValue(field)"
        :accent-color="uiColor"
        @update:model-value="updateField(field, $event)"
        @browse="selectFolderPath(field)"
      />
    </a-card>
  </a-card>
  <div style="height: 20px"></div>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { notification } from 'ant-design-vue'
import { ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import EngineFieldRenderer from '@renderer/components/engine/EngineFieldRenderer.vue'
import {
  applyEngineLanguageDefaults,
  getEngineFields,
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
import { useGeneralSettingStore } from '@renderer/stores/generalSetting'
import { useEngineControlStore } from '@renderer/stores/engineControl'

const { t } = useI18n()
const showMore = ref(false)
const engineControl = useEngineControlStore()
const { changeSignal } = storeToRefs(engineControl)
const generalSetting = useGeneralSettingStore()
const { uiColor, uiLanguage } = storeToRefs(generalSetting)
const draft = ref(cloneEngineConfig(engineControl.engineConfig))
let resettingDraft = false

const visibleFields = computed(() =>
  getEngineFields(draft.value.provider).filter((field) => {
    return isEngineFieldVisible(draft.value, field)
  })
)
const primaryFields = computed(() =>
  visibleFields.value.filter((field) => field.section === 'primary')
)
const advancedFields = computed(() =>
  visibleFields.value.filter((field) => field.section === 'advanced')
)
const customFields = computed(() =>
  visibleFields.value.filter((field) => field.section === 'custom')
)

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
  notification.open({
    placement: 'topLeft',
    message: t('noti.engineChange'),
    description: t('noti.changeInfo')
  })
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
  () => draft.value.provider,
  (provider) => {
    if (resettingDraft) return
    applyEngineLanguageDefaults(draft.value, provider, uiLanguage.value)
  },
  { flush: 'sync' }
)
</script>

<style scoped>
@import url(../assets/input.css);

.customize-note {
  padding: 10px 10px 0;
  max-width: min(40vw, 480px);
}
</style>
