<template>
  <a-card size="small" :title="$t('engine.appleSpeech.modelTitle')" class="model-card">
    <div class="model-summary">
      <a-tag :color="statusColor">{{ statusLabel }}</a-tag>
      <span>{{ locale }}</span>
      <a-button size="small" :loading="status.state === 'checking'" @click="check(true)">
        {{ $t('engine.appleSpeech.check') }}
      </a-button>
      <a-button
        v-if="status.state !== 'installed'"
        size="small"
        type="primary"
        @click="open = true"
      >
        {{ $t('engine.appleSpeech.manage') }}
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
    <p class="locale-line">{{ $t('engine.appleSpeech.locale') }}：{{ locale }}</p>
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
      >{{ $t('engine.appleSpeech.release', { locale: reservedLocale }) }}</a-button>
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
        v-if="status.state === 'supported' && !reservationFull"
        type="primary"
        @click="download"
      >{{ $t('engine.appleSpeech.download') }}</a-button>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useEngineControlStore } from '@renderer/stores/engineControl'

const props = defineProps<{ locale: string }>()
const store = useEngineControlStore()
const {
  appleSpeechModelStatus: status,
  appleSpeechModelDialogSignal
} = storeToRefs(store)
const { t } = useI18n()
const open = ref(false)

const statusLabel = computed(() => t(`engine.appleSpeech.states.${status.value.state}`))
const statusDescription = computed(() => {
  return t(`engine.appleSpeech.descriptions.${status.value.state}`)
})
const statusColor = computed(() => {
  if (status.value.state === 'installed') return 'green'
  if (status.value.state === 'failed' || status.value.state === 'unsupported') return 'red'
  if (status.value.state === 'downloading' || status.value.state === 'checking') return 'blue'
  return 'orange'
})
const reservationFull = computed(() => {
  return status.value.state === 'supported' &&
    status.value.maximumReservedLocales > 0 &&
    status.value.reservedLocales.length >= status.value.maximumReservedLocales &&
    !status.value.reservedLocales.includes(props.locale)
})

async function check(showDialog: boolean): Promise<void> {
  const result = await store.checkAppleSpeechModel(props.locale)
  if (showDialog || result.state !== 'installed') open.value = true
}

async function download(): Promise<void> {
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
.locale-line { color: var(--tag-color); }
.reservation-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
</style>
