<template>
  <router-view></router-view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { FullConfig } from './types'
import { useCaptionLogStore } from './stores/captionLog'
import { useSoftwareLogStore } from './stores/softwareLog'
import { useCaptionStyleStore } from './stores/captionStyle'
import { useEngineControlStore } from './stores/engineControl'
import { useGeneralSettingStore } from './stores/generalSetting'

onMounted(() => {
  window.electron.ipcRenderer.invoke('both.window.mounted').then((data: FullConfig) => {
    useGeneralSettingStore().setApplicationConfig(data.config.application)
    useCaptionStyleStore().setCaptionConfig(data.config.caption)
    useEngineControlStore().platform = data.platform
    useEngineControlStore().setEngineConfig(data.config.engine)
    useEngineControlStore().engineEnabled = data.engineEnabled
    useCaptionLogStore().captionData = data.captionLog
    useSoftwareLogStore().softwareLogs = data.softwareLog
  })
})
</script>
