import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { controlWindow } from './ControlWindow'
import { captionWindow } from './CaptionWindow'
import { allConfig } from './utils/AllConfig'
import { captionEngine } from './utils/CaptionEngine'
import { Log } from './utils/Log'

app.whenReady().then(() => {
  Log.initialize(app.getPath('userData'))
  Log.debug('Debug log session started', {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch
  })
  electronApp.setAppUserModelId('com.himeditator.autocaption')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  controlWindow.handleMessage()
  captionWindow.handleMessage()

  controlWindow.createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0){
      controlWindow.createWindow()
    }
  })
})

app.on('will-quit', async () => {
  captionEngine.kill()
  allConfig.writeConfig()
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
