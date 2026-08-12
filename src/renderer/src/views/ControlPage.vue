<template>
  <a-config-provider :theme="antdTheme">
    <a-layout class="control-container">
      <a-layout-sider
        class="settings-sider"
        :class="{ 'settings-sider-open': isSettingsPanelOpen }"
        :width="sidebarWidth"
        :collapsed="isNarrow"
        :collapsed-width="56"
        breakpoint="xl"
        :trigger="null"
        @breakpoint="handleBreakpoint"
      >
        <div
          ref="settingsShell"
          class="settings-shell"
          :class="{ 'settings-shell-narrow': isNarrow }"
          @pointerenter="handlePointerEnter"
          @pointerleave="handlePointerLeave"
          @focusin="temporarilyDismissed = false"
        >
          <div v-if="isNarrow" class="settings-rail">
            <a-tooltip
              placement="right"
              :title="$t('general.settings')"
              :open="isSettingsPanelOpen ? false : undefined"
            >
              <a-button
                type="text"
                class="settings-trigger"
                :aria-label="$t('general.settings')"
                :aria-expanded="isSettingsPanelOpen"
                :aria-pressed="isSettingsPinned"
                @click="toggleSettingsPin"
              >
                <SettingOutlined class="settings-trigger-icon" />
                <span class="settings-trigger-label">{{ $t('general.settings') }}</span>
              </a-button>
            </a-tooltip>
          </div>

          <aside
            class="settings-panel"
            :class="{ 'settings-panel-open': isSettingsPanelOpen }"
            :aria-hidden="isNarrow && !isSettingsPanelOpen"
          >
            <div class="caption-control">
              <GeneralSetting />
              <EngineControl />
              <CaptionStyle />
            </div>
          </aside>
        </div>
      </a-layout-sider>

      <a-layout-content class="caption-data">
        <EngineStatus />
        <div class="log-container">
          <a-menu v-model:selectedKeys="current" mode="horizontal" :items="items" />
          <div class="log-content">
            <CaptionLog v-if="current[0] === 'captionLog'" />
            <SoftwareLog v-else />
          </div>
        </div>
        <div id="caption-preview-host" class="caption-preview-host"></div>
      </a-layout-content>
    </a-layout>
  </a-config-provider>
</template>

<script setup lang="ts">
import GeneralSetting from '../components/GeneralSetting.vue'
import CaptionStyle from '../components/CaptionStyle.vue'
import EngineControl from '../components/EngineControl.vue'
import EngineStatus from '@renderer/components/EngineStatus.vue'
import CaptionLog from '../components/CaptionLog.vue'
import SoftwareLog from '@renderer/components/SoftwareLog.vue'
import { storeToRefs } from 'pinia'
import { useGeneralSettingStore } from '@renderer/stores/generalSetting'
import { computed, ref, watch } from 'vue'
import type { MenuProps } from 'ant-design-vue'
import { SettingOutlined } from '@ant-design/icons-vue'
import { onClickOutside, onKeyStroke, useFocusWithin } from '@vueuse/core'
import { logMenu } from '@renderer/i18n'

const generalSettingStore = useGeneralSettingStore()
const { leftBarWidth, antdTheme, uiLanguage } = storeToRefs(generalSettingStore)

const current = ref<string[]>(['captionLog'])
const items = ref<MenuProps['items']>(logMenu[uiLanguage.value])
const isNarrow = ref(false)
const isSettingsPinned = ref(false)
const isPointerInside = ref(false)
const temporarilyDismissed = ref(false)
const settingsShell = ref<HTMLElement | null>(null)
const { focused: isFocusInside } = useFocusWithin(settingsShell)

const sidebarWidth = computed(() => `${(leftBarWidth.value * 100) / 24}%`)
const isSettingsPanelOpen = computed(() => {
  if (!isNarrow.value) return true
  if (isSettingsPinned.value) return true
  if (temporarilyDismissed.value) return false
  return isPointerInside.value || isFocusInside.value
})

function handleBreakpoint(broken: boolean): void {
  isNarrow.value = broken
  if (!broken) {
    isSettingsPinned.value = false
    temporarilyDismissed.value = false
  }
}

function handlePointerEnter(): void {
  isPointerInside.value = true
  temporarilyDismissed.value = false
}

function handlePointerLeave(): void {
  isPointerInside.value = false
}

function closeSettingsPanel(): void {
  if (!isNarrow.value) return
  isSettingsPinned.value = false
  temporarilyDismissed.value = true
  const activeElement = document.activeElement
  if (activeElement instanceof HTMLElement && settingsShell.value?.contains(activeElement)) {
    activeElement.blur()
  }
}

function toggleSettingsPin(): void {
  if (!isNarrow.value) return
  if (isSettingsPinned.value) {
    closeSettingsPanel()
    return
  }
  isSettingsPinned.value = true
  temporarilyDismissed.value = false
}

onClickOutside(settingsShell, closeSettingsPanel, {
  ignore: [
    '.ant-select-dropdown',
    '.ant-dropdown',
    '.ant-popover',
    '.ant-modal-root',
    '.ant-notification',
    '.ant-message'
  ]
})

onKeyStroke('Escape', closeSettingsPanel)

watch(uiLanguage, (val) => {
  items.value = logMenu[val]
})
</script>

<style scoped>
.control-container {
  height: 100dvh;
  min-width: 0;
  min-height: 0;
  background-color: var(--control-background);
  overflow: hidden;
}

.settings-sider {
  position: relative;
  z-index: 2;
  min-width: 0;
  background: var(--control-background) !important;
  border-right: 1px solid var(--tag-color);
  overflow: visible;
}

.settings-sider-open {
  z-index: 10;
}

.settings-sider :deep(.ant-layout-sider-children) {
  overflow: visible;
}

.settings-shell,
.settings-panel,
.caption-control {
  height: 100%;
  min-height: 0;
}

.settings-shell {
  position: relative;
}

.settings-panel {
  width: 100%;
  background: var(--control-background);
}

.caption-control {
  box-sizing: border-box;
  padding: 20px;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.settings-rail {
  width: 56px;
  height: 100%;
  background: var(--control-background);
}

.settings-trigger {
  width: 56px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 20px 0;
  border-radius: 0;
  color: var(--icon-color);
}

.settings-trigger-icon {
  flex: none;
  font-size: 20px;
}

.settings-trigger-label {
  writing-mode: vertical-rl;
  letter-spacing: 0.12em;
  line-height: 1;
}

.settings-shell-narrow .settings-panel {
  position: absolute;
  top: 0;
  left: 56px;
  width: 360px;
  max-width: calc(100vw - 72px);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateX(-12px);
  border-right: 1px solid var(--tag-color);
  box-shadow: 10px 0 24px rgba(0, 0, 0, 0.2);
  transition:
    opacity 0.16s ease,
    transform 0.16s ease,
    visibility 0.16s ease;
}

.settings-shell-narrow .settings-panel-open {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateX(0);
}

.caption-data {
  box-sizing: border-box;
  height: 100dvh;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: var(--control-background);
  overflow: hidden;
}

.log-container {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 20px 10px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.log-content {
  min-width: 0;
  min-height: 0;
  padding: 16px;
  overflow: auto;
}

.caption-preview-host {
  box-sizing: border-box;
  flex: 0 1 auto;
  width: 100%;
  max-height: 35dvh;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.caption-preview-host:empty {
  display: none;
}

@container (max-width: 360px) {
  .caption-control :deep(.ant-card-head-wrapper) {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .caption-control :deep(.ant-card-extra) {
    margin-inline-start: 0;
    white-space: normal;
  }

  .caption-control :deep(.input-label),
  .caption-control :deep(.hotword-label) {
    flex-basis: 100%;
    text-align: left;
  }

  .caption-control :deep(.input-item-value) {
    padding-inline-start: 0;
  }
}

.settings-panel {
  container-type: inline-size;
}
</style>
