<template>
  <div class="log-toolbar">
    <div class="log-title">
      <span>{{ $t('log.title2') }}</span>
    </div>
    <div class="log-actions">
      <a-tag :color="debugStatus.enabled ? 'blue' : 'default'">
        {{ debugStatus.enabled ? $t('log.debugEnabled') : $t('log.debugDisabled') }}
      </a-tag>
      <a-tag :color="debugStatus.writeHealthy ? 'green' : 'red'">
        {{ debugStatus.writeHealthy ? $t('log.debugHealthy') : $t('log.debugUnhealthy') }}
        · {{ formatBytes(debugStatus.bytesWritten) }}
      </a-tag>
      <a-button @click="saveDebugLog">{{ $t('log.saveDebug') }}</a-button>
      <a-button
        danger
        @click="softwareLog.clear()"
      >{{ $t('log.clear') }}</a-button>
    </div>
  </div>
  <a-table
    :columns="columns"
    :data-source="softwareLogs"
    v-model:pagination="pagination"
    :scroll="{ x: 640 }"
    class="software-log-table"
  >
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'index'">
        {{ record.index }}
      </template>
      <template v-if="column.key === 'type'">
        <code :class="record.type">{{ record.type }}</code>
      </template>
      <template v-if="column.key === 'time'">
        <code>{{ record.time }}</code>
      </template>
      <template v-if="column.key === 'content'">
        <code>{{ record.text }}</code>
      </template>
    </template>
  </a-table>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSoftwareLogStore } from '@renderer/stores/softwareLog'
import { type SoftwareLogItem } from '../types'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const softwareLog = useSoftwareLogStore()
const { softwareLogs } = storeToRefs(softwareLog)

const debugStatus = reactive({
  enabled: false,
  writeHealthy: true,
  bytesWritten: 0
})
let statusTimer: number | undefined

async function refreshDebugStatus(): Promise<void> {
  try {
    const status = await window.electron.ipcRenderer.invoke(
      'control.debugLog.status'
    )
    debugStatus.enabled = status.enabled === true
    debugStatus.writeHealthy = status.writeHealthy === true
    debugStatus.bytesWritten = typeof status.bytesWritten === 'number'
      ? status.bytesWritten
      : 0
  }
  catch (error) {
    console.error('Unable to read Debug Mode status', error)
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
}

onMounted(() => {
  void refreshDebugStatus()
  statusTimer = window.setInterval(() => void refreshDebugStatus(), 1000)
})

onUnmounted(() => {
  if (statusTimer !== undefined) window.clearInterval(statusTimer)
})

async function saveDebugLog(): Promise<void> {
  const result = await window.electron.ipcRenderer.invoke(
    'control.debugLog.export'
  )
  if (result === 'saved') message.success(t('log.debugSaved'))
  else if (result !== 'canceled') message.error(t('log.debugSaveFailed'))
}

const pagination = ref({
  current: 1,
  pageSize: 20,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  onChange: (page: number, pageSize: number) => {
    pagination.value.current = page
    pagination.value.pageSize = pageSize
  },
  onShowSizeChange: (current: number, size: number) => {
    pagination.value.current = current
    pagination.value.pageSize = size
  }
})

const columns = [
  {
    title: 'index',
    dataIndex: 'index',
    key: 'index',
    width: 80,
    sorter: (a: SoftwareLogItem, b: SoftwareLogItem) => {
      if(a.index <= b.index) return -1
      return 1
    },
    sortDirections: ['descend'],
    defaultSortOrder: 'descend',
  },
  {
    title: 'type',
    dataIndex: 'type',
    key: 'type',
    width: 80,
    sorter: (a: SoftwareLogItem, b: SoftwareLogItem) => {
      if(a.type <= b.type) return -1
      return 1
    },
  },
  {
    title: 'time',
    dataIndex: 'time',
    key: 'time',
    width: 135,
    sortDirections: ['descend'],
  },
  {
    title: 'content',
    dataIndex: 'content',
    key: 'content',
  },
]

</script>

<style scoped>
.log-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
}

.log-title {
  color: var(--icon-color);
  display: inline-block;
  font-size: 24px;
  font-weight: bold;
  margin: 10px 0;
}

.log-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.software-log-table {
  min-width: 0;
  margin-top: 10px;
}

.WARN {
  color: #ff7c05;
  font-weight: bold;
}

.ERROR {
  color: #ff0000;
  font-weight: bold;
}
</style>
