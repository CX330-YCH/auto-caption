<template>
  <a-card size="small" :title="$t('engine.appleSpeech.modelTitle')" class="model-card">
    <div class="model-summary">
      <span class="locale-name">{{ localeDisplayName }}</span>
      <a-tag :color="statusColor">{{ statusLabel }}</a-tag>
      <span class="locale-code">{{ normalizedLocale }}</span>
      <a-button size="small" :loading="status.state === 'checking'" @click="check(true)">
        {{ $t('engine.appleSpeech.check') }}
      </a-button>
      <a-button
        v-if="readiness === 'needs_download' || readiness === 'needs_activation'"
        size="small"
        type="primary"
        @click="open = true"
      >
        {{ prepareActionLabel }}
      </a-button>
    </div>
  </a-card>

  <a-modal
    v-model:open="open"
    :title="$t('engine.appleSpeech.modelTitle')"
    :closable="status.state !== 'downloading'"
    :mask-closable="status.state !== 'downloading'"
  >
    <p>{{ statusDescription }}</p>
    <p class="locale-line">
      {{ $t('engine.appleSpeech.locale') }}：{{ localeDisplayName }}（{{ normalizedLocale }}）
    </p>
    <a-progress
      v-if="status.state === 'downloading'"
      :percent="Math.round((status.fractionCompleted ?? 0) * 100)"
      status="active"
    />
    <a-alert
      v-if="reservationFull"
      type="warning"
      show-icon
      :message="$t('engine.appleSpeech.reservationFull')"
      :description="$t('engine.appleSpeech.reservationFullDescription')"
    />
    <div v-if="reservationFull" class="reservation-list">
      <a-button
        v-for="reservedLocale in status.reservedLocales"
        :key="reservedLocale"
        size="small"
        danger
        @click="release(reservedLocale)"
      >{{ $t('engine.appleSpeech.release', {
        locale: displayName(reservedLocale)
      }) }}</a-button>
    </div>
    <template #footer>
      <a-button :disabled="status.state === 'downloading'" @click="open = false">
        {{ $t('engine.appleSpeech.close') }}
      </a-button>
      <a-button
        v-if="status.state === 'failed' || status.state === 'unknown'"
        @click="check(false)"
      >{{ $t('engine.appleSpeech.retry') }}</a-button>
      <a-button
        v-if="(readiness === 'needs_download' || readiness === 'needs_activation') && !reservationFull"
        type="primary"
        @click="prepare"
      >{{ prepareActionLabel }}</a-button>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useEngineControlStore } from '@renderer/stores/engineControl'
import { useGeneralSettingStore } from '@renderer/stores/generalSetting'
import { appleSpeechLocaleDisplayName } from '@renderer/engines/appleSpeechLocale.ts'
import {
  appleSpeechLocalesEqual,
  getAppleSpeechReadiness,
  normalizeAppleSpeechLocale
} from '../../../../shared/appleSpeech.ts'

const props = defineProps<{ locale: string }>()
const store = useEngineControlStore()
const generalSetting = useGeneralSettingStore()
const {
  appleSpeechModelStatus: status,
  appleSpeechModelDialogSignal
} = storeToRefs(store)
const { t } = useI18n()
const open = ref(false)

const normalizedLocale = computed(() => normalizeAppleSpeechLocale(props.locale))
const localeDisplayName = computed(() => displayName(props.locale))
const readiness = computed(() => getAppleSpeechReadiness(status.value))
const statusLabel = computed(() => t(`engine.appleSpeech.readiness.${readiness.value}`))
const statusDescription = computed(() => {
  return t(`engine.appleSpeech.readinessDescriptions.${readiness.value}`)
})
const prepareActionLabel = computed(() => t(
  readiness.value === 'needs_activation'
    ? 'engine.appleSpeech.activate'
    : 'engine.appleSpeech.prepare'
))
const statusColor = computed(() => {
  if (readiness.value === 'ready') return 'green'
  if (readiness.value === 'failed' || readiness.value === 'unsupported') return 'red'
  if (readiness.value === 'preparing' || readiness.value === 'checking') return 'blue'
  return 'orange'
})
const reservationFull = computed(() => {
  return (readiness.value === 'needs_download' || readiness.value === 'needs_activation') &&
    status.value.maximumReservedLocales > 0 &&
    status.value.reservedLocales.length >= status.value.maximumReservedLocales &&
    !status.value.reservedLocales.some((locale) =>
      appleSpeechLocalesEqual(locale, props.locale)
    )
})

function displayName(locale: string): string {
  return appleSpeechLocaleDisplayName(locale, generalSetting.uiLanguage, t)
}

async function check(showDialog: boolean): Promise<void> {
  const result = await store.checkAppleSpeechModel(props.locale)
  if (
    appleSpeechLocalesEqual(result.locale, props.locale) &&
    (showDialog || result.state !== 'installed')
  ) open.value = true
}

async function prepare(): Promise<void> {
  open.value = true
  await store.installAppleSpeechModel(props.locale)
}

async function release(locale: string): Promise<void> {
  await store.releaseAppleSpeechModel(locale)
}

onMounted(() => { void check(false) })
watch(() => props.locale, () => { void check(false) })
watch(appleSpeechModelDialogSignal, () => { open.value = true })
</script>

<style scoped>
.model-card { margin-top: 10px; }
.model-summary { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.locale-name { font-weight: 600; }
.locale-code { color: var(--tag-color); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.locale-line { color: var(--tag-color); }
.reservation-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
</style>
