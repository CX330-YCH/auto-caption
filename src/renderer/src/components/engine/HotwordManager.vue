<template>
  <a-card size="small" :title="$t('engine.hotwords.levelOneTitle')">
    <p class="hotword-note">{{ $t('engine.hotwords.levelOneNote') }}</p>
    <div class="input-item">
      <span class="hotword-label">{{ $t('engine.hotwords.vocabularyId') }}</span>
      <a-input
        class="hotword-input"
        :value="modelValue.vocabularyId"
        :placeholder="$t('engine.hotwords.vocabularyIdPlaceholder')"
        @update:value="updateVocabularyId"
      />
    </div>
    <div class="input-item">
      <span class="hotword-label">{{ $t('engine.hotwords.targetModel') }}</span>
      <a-select
        class="hotword-input"
        :value="modelValue.targetModel"
        :options="modelOptions"
        @update:value="updateTargetModel"
      />
    </div>
    <div class="input-item context-row">
      <span class="hotword-label">{{ $t('engine.hotwords.contextTerms') }}</span>
      <a-textarea
        class="hotword-input"
        :value="contextText"
        :maxlength="400"
        :rows="4"
        :placeholder="$t('engine.hotwords.contextTermsPlaceholder')"
        show-count
        @update:value="updateContextTerms"
      />
    </div>
    <p class="hotword-note">{{ $t('engine.hotwords.contextTermsNote') }}</p>
  </a-card>

  <a-card
    size="small"
    :title="$t('engine.hotwords.levelTwoTitle')"
    class="remote-card"
  >
    <p class="hotword-note">{{ $t('engine.hotwords.remoteImmediateNote') }}</p>
    <a-descriptions size="small" bordered :column="1">
      <a-descriptions-item :label="$t('engine.hotwords.account')">
        {{ $t('engine.hotwords.apiKeyAccount') }}
      </a-descriptions-item>
      <a-descriptions-item :label="$t('engine.hotwords.workspace')">
        {{ appliedWorkspaceId || '-' }}
      </a-descriptions-item>
      <a-descriptions-item :label="$t('engine.hotwords.region')">
        {{ regionLabel }}
      </a-descriptions-item>
      <a-descriptions-item :label="$t('engine.hotwords.targetModel')">
        {{ appliedModel }}
      </a-descriptions-item>
    </a-descriptions>

    <a-space class="manager-toolbar" wrap>
      <a-input
        v-model:value="listPrefix"
        :placeholder="$t('engine.hotwords.prefixFilter')"
        :maxlength="10"
      />
      <a-button :loading="loading" @click="refresh">{{ $t('engine.hotwords.refresh') }}</a-button>
      <a-button type="primary" :disabled="!managementReady" @click="openCreate">
        {{ $t('engine.hotwords.create') }}
      </a-button>
    </a-space>

    <a-alert
      v-if="!managementReady"
      type="warning"
      show-icon
      :message="$t('engine.hotwords.applyConnectionFirst')"
      class="manager-alert"
    />
    <a-alert
      v-if="isSingapore"
      type="warning"
      show-icon
      :message="$t('engine.hotwords.singaporeSubworkspaceWarning')"
      class="manager-alert"
    />

    <a-list size="small" bordered :data-source="resources" class="resource-list">
      <template #empty>
        <a-empty :description="$t('engine.hotwords.empty')" />
      </template>
      <template #renderItem="{ item }">
        <a-list-item>
          <template #actions>
            <a @click="selectResource(item)">{{ $t('engine.hotwords.use') }}</a>
            <a @click="openEdit(item)">{{ $t('engine.hotwords.edit') }}</a>
            <a class="danger-action" @click="confirmDelete(item)">
              {{ $t('engine.hotwords.delete') }}
            </a>
          </template>
          <a-list-item-meta
            :title="item.vocabularyId"
            :description="`${item.status} · ${item.modifiedAt || '-'}`"
          />
        </a-list-item>
      </template>
    </a-list>

    <a-space class="pagination-row">
      <a-button :disabled="pageIndex === 0 || loading" @click="previousPage">
        {{ $t('engine.hotwords.previous') }}
      </a-button>
      <span>{{ $t('engine.hotwords.page', { page: pageIndex + 1 }) }}</span>
      <a-button :disabled="resources.length < pageSize || loading" @click="nextPage">
        {{ $t('engine.hotwords.next') }}
      </a-button>
    </a-space>
  </a-card>

  <a-modal
    v-model:open="editorOpen"
    :title="editorMode === 'create' ? $t('engine.hotwords.createTitle') : $t('engine.hotwords.editTitle')"
    :confirm-loading="loading"
    @ok="submitEditor"
  >
    <div v-if="editorMode === 'create'" class="input-item">
      <span class="editor-label">{{ $t('engine.hotwords.prefix') }}</span>
      <a-input v-model:value="editorPrefix" :maxlength="10" />
    </div>
    <p v-else>{{ editorVocabularyId }}</p>
    <p class="hotword-note">{{ $t('engine.hotwords.entryFormat') }}</p>
    <a-textarea
      v-model:value="editorEntries"
      :rows="10"
      :placeholder="$t('engine.hotwords.entryPlaceholder')"
    />
  </a-modal>
</template>

<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { Modal, notification } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import type { FunAsrHotwordConfig } from '../../../../shared/config/schema.ts'
import type {
  HotwordRequest,
  HotwordResource,
  HotwordResponse,
  HotwordSummary
} from '../../../../shared/hotwords.ts'
import { parseHotwordEntriesText } from '../../../../shared/hotwords.ts'

const props = defineProps<{
  modelValue: FunAsrHotwordConfig
  appliedModel: string
  appliedWorkspaceId: string
  appliedWebsocketUrl: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: FunAsrHotwordConfig]
}>()

const { t } = useI18n()
const resources = ref<HotwordSummary[]>([])
const loading = ref(false)
const listPrefix = ref('')
const pageIndex = ref(0)
const pageSize = 10
const editorOpen = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const editorPrefix = ref('')
const editorVocabularyId = ref('')
const editorEntries = ref('')

const modelOptions = computed(() => [
  { value: 'fun-asr-realtime', label: t('engine.options.funAsrModels.current') },
  {
    value: 'fun-asr-realtime-2025-11-07',
    label: t('engine.options.funAsrModels.snapshot')
  }
])
const contextText = computed(() => props.modelValue.contextTerms.join('\n'))
const managementReady = computed(() => Boolean(
  props.appliedWorkspaceId && props.appliedWebsocketUrl
))
const isSingapore = computed(() => props.appliedWebsocketUrl.includes('ap-southeast-1'))
const regionLabel = computed(() => {
  if (props.appliedWebsocketUrl.includes('cn-beijing')) {
    return t('engine.hotwords.beijing')
  }
  if (isSingapore.value) return t('engine.hotwords.singapore')
  return '-'
})

function updateLocal(patch: Partial<FunAsrHotwordConfig>): void {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

function updateVocabularyId(value: string): void {
  updateLocal({ vocabularyId: value.trim() })
}

function updateTargetModel(value: string): void {
  updateLocal({ targetModel: value })
}

function updateContextTerms(value: string): void {
  const terms = [...new Set(value.split(/\r?\n/).map((term) => term.trim()).filter(Boolean))]
  updateLocal({ contextTerms: terms })
}

async function execute(request: HotwordRequest): Promise<unknown | null> {
  loading.value = true
  try {
    const response = await window.electron.ipcRenderer.invoke(
      'control.hotwords.execute',
      request
    ) as HotwordResponse
    if (!response.ok) {
      notification.error({
        message: t('engine.hotwords.operationFailed'),
        description: t(`engine.hotwords.errors.${response.errorCode}`)
      })
      return null
    }
    return response.data
  }
  finally {
    loading.value = false
  }
}

async function refresh(): Promise<void> {
  if (!managementReady.value) return
  const data = await execute({
    action: 'list',
    prefix: listPrefix.value,
    pageIndex: pageIndex.value,
    pageSize
  })
  if (Array.isArray(data)) resources.value = data as HotwordSummary[]
}

function previousPage(): void {
  if (pageIndex.value === 0) return
  pageIndex.value -= 1
  void refresh()
}

function nextPage(): void {
  pageIndex.value += 1
  void refresh()
}

function openCreate(): void {
  editorMode.value = 'create'
  editorPrefix.value = ''
  editorVocabularyId.value = ''
  editorEntries.value = ''
  editorOpen.value = true
}

async function queryResource(item: HotwordSummary): Promise<HotwordResource | null> {
  const data = await execute({ action: 'query', vocabularyId: item.vocabularyId })
  return data && typeof data === 'object' ? data as HotwordResource : null
}

async function selectResource(item: HotwordSummary): Promise<void> {
  const resource = await queryResource(item)
  if (!resource) return
  if (resource.targetModel !== props.appliedModel) {
    showModelMismatch()
    return
  }
  updateLocal({
    vocabularyId: resource.vocabularyId,
    targetModel: resource.targetModel
  })
  notification.success({ message: t('engine.hotwords.selected') })
}

async function openEdit(item: HotwordSummary): Promise<void> {
  const resource = await queryResource(item)
  if (!resource) return
  if (resource.targetModel !== props.appliedModel) {
    showModelMismatch()
    return
  }
  editorMode.value = 'edit'
  editorVocabularyId.value = resource.vocabularyId
  editorEntries.value = resource.vocabulary
    .map((entry) => `${entry.text} | ${entry.weight} | ${entry.lang ?? ''}`)
    .join('\n')
  editorOpen.value = true
}

async function submitEditor(): Promise<void> {
  try {
    const vocabulary = parseHotwordEntriesText(editorEntries.value)
    const request: HotwordRequest = editorMode.value === 'create'
      ? { action: 'create', prefix: editorPrefix.value, vocabulary }
      : {
          action: 'update',
          vocabularyId: editorVocabularyId.value,
          vocabulary
        }
    const data = await execute(request)
    if (!data) return
    if (editorMode.value === 'create') {
      const created = data as { vocabularyId: string; targetModel: string }
      updateLocal({
        vocabularyId: created.vocabularyId,
        targetModel: created.targetModel
      })
    }
    editorOpen.value = false
    notification.success({ message: t('engine.hotwords.operationSucceeded') })
    await refresh()
  }
  catch {
    notification.error({
      message: t('engine.hotwords.invalidEntries'),
      description: t('engine.hotwords.invalidEntriesNote')
    })
  }
}

async function confirmDelete(item: HotwordSummary): Promise<void> {
  const resource = await queryResource(item)
  if (!resource) return
  if (resource.targetModel !== props.appliedModel) {
    showModelMismatch()
    return
  }
  Modal.confirm({
    title: t('engine.hotwords.deleteConfirmTitle'),
    content: h('div', [
      h('p', `${t('engine.hotwords.account')}: ${t('engine.hotwords.apiKeyAccount')}`),
      h('p', `${t('engine.hotwords.workspace')}: ${props.appliedWorkspaceId}`),
      h('p', `${t('engine.hotwords.region')}: ${regionLabel.value}`),
      h('p', `${t('engine.hotwords.targetModel')}: ${resource.targetModel}`),
      h('p', `${t('engine.hotwords.vocabularyId')}: ${resource.vocabularyId}`),
      h('p', t('engine.hotwords.deleteIrreversible'))
    ]),
    okType: 'danger',
    onOk: async () => {
      const data = await execute({
        action: 'delete',
        vocabularyId: resource.vocabularyId
      })
      if (!data) return
      if (props.modelValue.vocabularyId === resource.vocabularyId) {
        updateLocal({ vocabularyId: '' })
      }
      notification.success({ message: t('engine.hotwords.operationSucceeded') })
      await refresh()
    }
  })
}

function showModelMismatch(): void {
  notification.error({
    message: t('noti.funAsrHotwordModelMismatch'),
    description: t('noti.funAsrHotwordModelMismatchNote')
  })
}
</script>

<style scoped>
.input-item {
  display: grid;
  grid-template-columns: minmax(90px, 110px) minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  row-gap: 6px;
  margin: 12px 0;
}

.remote-card {
  margin-top: 10px;
}

.hotword-note {
  color: #666;
  margin: 8px 0;
}

.hotword-label,
.editor-label {
  grid-column: 1;
  min-width: 0;
  text-align: right;
  overflow-wrap: anywhere;
}

.hotword-input {
  grid-column: 2;
  width: 100%;
  min-width: 0;
}

.context-row {
  align-items: flex-start;
}

.manager-toolbar,
.manager-alert,
.resource-list,
.pagination-row {
  margin-top: 12px;
}

.manager-toolbar {
  width: 100%;
}

.manager-toolbar :deep(.ant-space-item:first-child) {
  min-width: 120px;
  flex: 1 1 160px;
}

.danger-action {
  color: #ff4d4f;
}

@container (max-width: 480px) {
  .input-item {
    grid-template-columns: minmax(0, 1fr);
  }

  .hotword-label,
  .editor-label,
  .hotword-input,
  .input-item > :deep(.ant-input) {
    grid-column: 1;
  }

  .hotword-label,
  .editor-label {
    text-align: left;
  }
}
</style>
