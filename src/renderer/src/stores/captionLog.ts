import { ref } from 'vue'
import { defineStore } from 'pinia'
import { CaptionItem } from '../types'
import { upsertCaptionItem } from '../../../shared/captions.ts'

export const useCaptionLogStore = defineStore('captionLog', () => {
  const captionData = ref<CaptionItem[]>([])

  function clear() {
    captionData.value = []
    window.electron.ipcRenderer.send('control.captionLog.clear')
  }

  window.electron.ipcRenderer.on('both.captionLog.upsert', (_, log) => {
    upsertCaptionItem(captionData.value, log)
  })

  window.electron.ipcRenderer.on('both.captionLog.set', (_, logs) => {
    captionData.value = logs
  })

  return {
    captionData,
    clear
  }
})
