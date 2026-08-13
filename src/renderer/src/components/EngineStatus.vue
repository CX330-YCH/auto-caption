<template>
  <div class="caption-stat">
    <div class="status-grid">
      <div class="status-item">
        <a-statistic
          :title="$t('status.engine')"
          :value="engine"
        />
      </div>
      <a-popover :title="$t('status.engineStatus')">
        <template #content>
          <a-row class="engine-status">
            <a-col :flex="1" :title="$t('status.pid')" style="cursor:pointer;">
              <div class="engine-status-title">pid</div>
              <div>{{ pid }}</div>
            </a-col>
            <a-col :flex="1" :title="$t('status.ppid')" style="cursor:pointer;">
              <div class="engine-status-title">ppid</div>
              <div>{{ ppid }}</div>
            </a-col>
            <a-col :flex="1" :title="$t('status.port')" style="cursor:pointer;">
              <div class="engine-status-title">port</div>
              <div>{{ port }}</div>
            </a-col>
            <a-col :flex="1" :title="$t('status.cpu')" style="cursor:pointer;">
              <div class="engine-status-title">cpu</div>
              <div>{{ cpu.toFixed(1) }}%</div>
            </a-col>
            <a-col :flex="1" :title="$t('status.mem')" style="cursor:pointer;">
              <div class="engine-status-title">mem</div>
              <div>{{ (mem/1024/1024).toFixed(2) }}MB</div>
            </a-col>
            <a-col :flex="1" :title="$t('status.elapsed')" style="cursor:pointer;">
              <div class="engine-status-title">elapsed</div>
              <div>{{ (elapsed/1000).toFixed(0) }}s</div>
            </a-col>
          </a-row>
        </template>
        <div class="status-item status-item-interactive" @mouseenter="getEngineInfo">
          <a-statistic
            :title="$t('status.status')"
            :value="engineEnabled?$t('status.started'):$t('status.stopped')"
          >
            <template #suffix v-if="engineEnabled">
              <InfoCircleOutlined style="font-size:18px;color:#1677ff"/>
            </template>
          </a-statistic>
        </div>
      </a-popover>
      <div class="status-item">
        <a-statistic :title="$t('status.logNumber')" :value="captionData.length" />
      </div>
      <div class="status-item">
        <a-statistic :title="$t('status.logNumber2')" :value="softwareLogs.length" />
      </div>
      <div class="status-item">
        <div class="about-tag">{{ $t('status.aboutProj') }}</div>
        <GithubOutlined class="proj-info" @click="showAbout = true"/>
      </div>
    </div>
  </div>

  <div class="caption-control">
    <a-button
      type="primary"
      class="control-button"
      @click="openCaptionWindow"
    >{{ $t('status.openCaption') }}</a-button>
    <a-button
      v-if="!isStarting"
      class="control-button"
      :loading="pending && !engineEnabled"
      :disabled="pending || engineEnabled"
      @click="startEngine"
    >{{ $t('status.startEngine') }}</a-button>
    <a-popconfirm
      v-if="isStarting"
      :title="$t('status.forceKillConfirm')"
      :ok-text="$t('status.confirm')"
      :cancel-text="$t('status.cancel')"
      @confirm="forceKillEngine"
    >
      <a-button
        danger
        class="control-button"
        type="primary"
        :icon="h(LoadingOutlined)"
      >{{ $t('status.forceKillStarting') }}</a-button>
    </a-popconfirm>
    <a-button
     danger class="control-button"
     :loading="pending && engineEnabled"
     :disabled="pending || !engineEnabled"
     @click="stopEngine"
    >{{ $t('status.stopEngine') }}</a-button>
  </div>

  <a-modal v-model:open="showAbout" :title="$t('status.about.title')" :footer="null">
    <div class="about-modal-content">
      <h2 class="about-title">{{ $t('status.about.proj') }}</h2>
      <p class="about-desc">{{ $t('status.about.desc') }}</p>
      <a-divider />
      <div class="about-info">
        <p><b>{{ $t('status.about.version') }}</b><a-tag color="green">v2.6.0</a-tag></p>
        <p>
          <b>{{ $t('status.about.author') }}</b>
          <a
            href="https://github.com/HiMeditator"
            target="_blank"
          >
            <a-tag color="blue">HiMeditator</a-tag>
          </a>
        </p>
        <p>
          <b>{{ $t('status.about.projLink') }}</b>
          <a href="https://github.com/HiMeditator/auto-caption" target="_blank">
            <a-tag color="blue">GitHub | auto-caption</a-tag>
          </a>
        </p>
        <p>
          <b>{{ $t('status.about.manual') }}</b>
          <a
            :href="`https://github.com/HiMeditator/auto-caption/tree/main/docs/user-manual/${$t('lang')}.md`"
            target="_blank"
          >
            <a-tag color="blue">GitHub | user-manual/{{ $t('lang') }}.md</a-tag>
          </a>
        </p>
        <p>
          <b>{{ $t('status.about.engineDoc') }}</b>
          <a
            :href="`https://github.com/HiMeditator/auto-caption/tree/main/docs/engine-manual/${$t('lang')}.md`"
            target="_blank"
          >
            <a-tag color="blue">GitHub | engine-manual/{{ $t('lang') }}.md</a-tag>
          </a>
        </p>
      </div>
      <div class="about-date">{{ $t('status.about.date') }}</div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import type { EngineInfo } from '@renderer/types'
import { computed, ref, watch, h } from 'vue'
import { storeToRefs } from 'pinia'
import { useCaptionLogStore } from '@renderer/stores/captionLog'
import { useSoftwareLogStore } from '@renderer/stores/softwareLog'
import { useEngineControlStore } from '@renderer/stores/engineControl'
import { GithubOutlined, InfoCircleOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import { validateEngineConfig } from '@renderer/engines/catalog.ts'
import {
  getActiveBuiltinProvider,
  getActiveCustomEngine
} from '../../../shared/config/schema.ts'

const showAbout = ref(false)
const pending = ref(false)
const isStarting = ref(false)

const captionLog = useCaptionLogStore()
const { captionData } = storeToRefs(captionLog)
const softwareLog = useSoftwareLogStore()
const { softwareLogs } = storeToRefs(softwareLog)
const engineControl = useEngineControlStore()
const { engineEnabled, engineConfig, errorSignal } = storeToRefs(engineControl)
const engine = computed(() => {
  return getActiveCustomEngine(engineConfig.value)?.name ??
    getActiveBuiltinProvider(engineConfig.value) ?? ''
})

const pid = ref(0)
const ppid = ref(0)
const port = ref(0)
const cpu = ref(0)
const mem = ref(0)
const elapsed = ref(0)

function openCaptionWindow() {
  window.electron.ipcRenderer.send('control.captionWindow.activate')
}

function startEngine() {
  pending.value = true
  isStarting.value = true
  const validationIssue = validateEngineConfig(engineControl.engineConfig, 'start')
  if(validationIssue) {
    engineControl.showConfigValidationError(validationIssue)
    pending.value = false
    isStarting.value = false
    return
  }
  window.electron.ipcRenderer.send('control.engine.start')
}

function stopEngine() {
  pending.value = true
  window.electron.ipcRenderer.send('control.engine.stop')
}

function forceKillEngine() {
  pending.value = true
  isStarting.value = false
  window.electron.ipcRenderer.send('control.engine.forceKill')
}

function getEngineInfo() {
  window.electron.ipcRenderer.invoke('control.engine.info').then((data: EngineInfo) => {
    pid.value = data.pid
    ppid.value = data.ppid
    port.value = data.port
    cpu.value = data.cpu
    mem.value = data.mem
    elapsed.value = data.elapsed
  })
}

watch(engineEnabled, (enabled) => {
  pending.value = false
  if (enabled) {
    isStarting.value = false
  }
})

watch(errorSignal, () => {
  pending.value = false
  isStarting.value = false
  errorSignal.value = false
})
</script>

<style scoped>
.engine-status {
  width: max(420px, 36vw);
  display: flex;
  align-items: center;
  padding: 5px 10px;
}

.engine-status-title {
  font-size: 12px;
  color: var(--tag-color);
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
}

.status-item {
  min-width: 0;
}

.status-item-interactive {
  cursor: pointer;
}

.about-tag {
  color: var(--tag-color);
  margin-bottom: 16px;
}

.proj-info {
  display: inline-block;
  font-size: 24px;
  cursor: pointer;
  color: var(--icon-color);
}

.about-modal-content {
  text-align: center;
  padding: 8px 0 0 0;
}

.about-title {
  font-size: 1.5em;
  font-weight: bold;
  margin-bottom: 0.2em;
}

.about-desc {
  color: #666;
  margin-bottom: 0.5em;
}

.about-info {
  text-align: left;
  display: inline-block;
  margin: 0 auto;
  font-size: 1em;
}

.about-info b {
  margin-right: 1em;
}

.about-date {
  margin-top: 1.5em;
  color: #aaa;
  font-size: 0.95em;
  text-align: right;
}

.caption-control {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
  margin: 0;
}

.control-button {
  height: 40px;
  font-size: 16px;
}
</style>
