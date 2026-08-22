<template>
  <SettingsField :label="label">
    <a-input
      v-if="manualMode"
      class="font-family-primary"
      :value="modelValue"
      :status="fontValueValid ? '' : 'error'"
      :placeholder="t('style.fontPicker.manualPlaceholder')"
      @update:value="updateManualValue"
    />
    <a-select
      v-else
      class="font-family-primary"
      :value="selectedValue"
      :loading="accessState === 'loading'"
      :not-found-content="t('style.fontPicker.noResults')"
      show-search
      virtual
      option-filter-prop="label"
      @change="selectFont"
      @dropdown-visible-change="handleDropdownVisibleChange"
    >
      <a-select-option
        v-for="option in displayedOptions"
        :key="option.value"
        :value="option.value"
        :label="option.family"
      >
        <span class="font-option" :style="{ fontFamily: option.value }">
          {{ option.family }}
        </span>
        <span v-if="option.custom" class="font-option-kind">
          {{ t('style.fontPicker.customValue') }}
        </span>
      </a-select-option>
    </a-select>

    <template #description>
      <div class="font-picker-actions">
        <button type="button" class="font-picker-link" @click="toggleManualMode">
          {{ manualMode
            ? t('style.fontPicker.useSystemFonts')
            : t('style.fontPicker.useManualInput') }}
        </button>
        <button
          v-if="!manualMode"
          type="button"
          class="font-picker-link"
          :disabled="accessState === 'loading'"
          @click="refreshFonts"
        >
          {{ t('style.fontPicker.refresh') }}
        </button>
      </div>

      <div v-if="statusMessage" class="font-picker-status" :class="statusClass">
        {{ statusMessage }}
      </div>
      <div
        class="font-picker-preview"
        :style="fontValueValid ? { fontFamily: modelValue } : undefined"
      >
        {{ t('style.fontPicker.previewText') }}
      </div>
    </template>
  </SettingsField>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsField from './SettingsField.vue'
import {
  createFontFamilyOptions,
  findMatchingFontOption,
  isValidFontFamilyValue,
  parseSingleFontFamily,
  type FontFamilyOption
} from '@renderer/utils/fontFamily.ts'
import {
  loadLocalFontOptions,
  LocalFontQueryError
} from '@renderer/utils/localFonts.ts'

type LocalFontAccessState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'denied'
  | 'unsupported'
  | 'failed'

interface DisplayedFontOption extends FontFamilyOption {
  custom?: boolean
}

const props = defineProps<{
  label: string
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'validity-change': [valid: boolean]
}>()

const { locale, t } = useI18n()
const manualMode = ref(false)
const accessState = ref<LocalFontAccessState>('idle')
const fontOptions = ref<FontFamilyOption[]>(createFontFamilyOptions([], locale.value))

const fontValueValid = computed(() => isValidFontFamilyValue(props.modelValue))
const matchedOption = computed(() => findMatchingFontOption(
  props.modelValue,
  fontOptions.value
))
const selectedValue = computed(() => matchedOption.value?.value ?? props.modelValue)
const displayedOptions = computed<DisplayedFontOption[]>(() => {
  if (matchedOption.value || !props.modelValue.trim()) return fontOptions.value
  return [{
    family: props.modelValue,
    value: props.modelValue,
    generic: false,
    styles: [],
    custom: true
  }, ...fontOptions.value]
})

const statusMessage = computed(() => {
  if (!fontValueValid.value) return t('style.fontPicker.invalidValue')
  if (accessState.value === 'loading') return t('style.fontPicker.loading')
  if (accessState.value === 'denied') return t('style.fontPicker.denied')
  if (accessState.value === 'unsupported') return t('style.fontPicker.unsupported')
  if (accessState.value === 'failed') return t('style.fontPicker.failed')
  if (accessState.value !== 'ready' || matchedOption.value) return ''
  return parseSingleFontFamily(props.modelValue)
    ? t('style.fontPicker.unavailable')
    : t('style.fontPicker.customStack')
})

const statusClass = computed(() => ({
  error: !fontValueValid.value,
  warning: fontValueValid.value && (
    accessState.value === 'denied' ||
    accessState.value === 'unsupported' ||
    accessState.value === 'failed'
  )
}))

watch(fontValueValid, valid => emit('validity-change', valid), {
  immediate: true
})

function updateManualValue(value: string): void {
  emit('update:modelValue', value)
}

function selectFont(value: string): void {
  emit('update:modelValue', value)
}

function toggleManualMode(): void {
  manualMode.value = !manualMode.value
}

function handleDropdownVisibleChange(open: boolean): void {
  if (open && accessState.value === 'idle') void loadFonts(false)
}

function refreshFonts(): void {
  if (accessState.value === 'loading') return
  void loadFonts(true)
}

async function loadFonts(forceRefresh: boolean): Promise<void> {
  accessState.value = 'loading'
  try {
    fontOptions.value = await loadLocalFontOptions(locale.value, forceRefresh)
    accessState.value = 'ready'
  }
  catch (error) {
    accessState.value = error instanceof LocalFontQueryError
      ? error.reason
      : 'failed'
    manualMode.value = true
  }
}
</script>

<style scoped>
.font-family-primary {
  width: 100%;
}

.font-option {
  margin-right: 8px;
}

.font-option-kind {
  color: var(--tag-color);
  font-size: 12px;
}

.font-picker-actions {
  display: flex;
  gap: 8px;
}

.font-picker-link {
  padding: 0;
  border: 0;
  color: #1677ff;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  background: transparent;
}

.font-picker-link:disabled {
  color: var(--tag-color);
  cursor: default;
}

.font-picker-status,
.font-picker-preview {
  color: var(--tag-color);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.font-picker-status.warning {
  color: #d48806;
}

.font-picker-status.error {
  color: #ff4d4f;
}

.font-picker-preview {
  overflow: hidden;
  color: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
