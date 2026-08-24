import { shell, BrowserWindow, ipcMain, nativeTheme, dialog } from 'electron'
import path from 'path'
import { EngineInfo } from './types'
import pidusage from 'pidusage'
import { is } from '@electron-toolkit/utils'
import icon from '../../build/icon.png?asset'
import { captionWindow } from './CaptionWindow'
import { allConfig } from './utils/AllConfig'
import { captionEngine } from './utils/CaptionEngine'
import { Log } from './utils/Log'
import { hotwordService } from './services/HotwordService'
import { appleSpeechService } from './services/AppleSpeechService.ts'
import type { AppleSpeechStartResult } from '../shared/appleSpeech.ts'
import { getActiveBuiltinProvider } from '../shared/config/schema.ts'
import { diagnosticsCoordinator } from './logging/DiagnosticsCoordinator.ts'

class ControlWindow {
  mounted: boolean = false;
  window: BrowserWindow | undefined;

  public createWindow(): void {
    allConfig.readConfig()
    diagnosticsCoordinator.setEnabled(
      allConfig.application.diagnostics.debugMode
    )
    Log.verbose('debug-mode', 'configuration-snapshot', allConfig.config)

    this.window = new BrowserWindow({
      icon: icon,
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      show: false,
      center: true,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    diagnosticsCoordinator.attachWindow(this.window, 'control-renderer')

    this.window.on('ready-to-show', () => {
      this.window?.show()
    })

    this.window.on('closed', () => {
      this.mounted = false
      this.window = undefined
      allConfig.writeConfig()
    })

    this.window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.window.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      this.window.loadFile(path.join(__dirname, '../renderer/index.html'))
    }
  }

  public handleMessage() {
    nativeTheme.on('updated', () => {
      if(allConfig.uiTheme === 'system'){
        if(nativeTheme.shouldUseDarkColors && this.window){
          this.window.webContents.send('control.nativeTheme.change', 'dark')
        }
        else if(!nativeTheme.shouldUseDarkColors && this.window){
          this.window.webContents.send('control.nativeTheme.change', 'light')
        }
      }
    })

    ipcMain.handle('both.window.mounted', () => {
      this.mounted = true
      return allConfig.getFullConfig(Log.getAndClearLogQueue())
    })

    ipcMain.handle('control.nativeTheme.get', () => {
      if(allConfig.uiTheme === 'system'){
        if(nativeTheme.shouldUseDarkColors) return 'dark'
        return 'light'
      }
      return allConfig.uiTheme
    })

    ipcMain.handle('control.folder.select', async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      });

      if (result.canceled) return "";
      return result.filePaths[0];
    })

    ipcMain.handle('control.debugLog.export', async () => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const options = {
        defaultPath: `auto-caption-debug-${timestamp}.jsonl`,
        filters: [{ name: 'JSON Lines', extensions: ['jsonl'] }]
      }
      const result = this.window
        ? await dialog.showSaveDialog(this.window, options)
        : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return 'canceled'
      try {
        return Log.exportDebugSession(result.filePath) ? 'saved' : 'unavailable'
      }
      catch (error) {
        Log.error('Unable to export debug log', error)
        return 'failed'
      }
    })

    ipcMain.handle('control.debugLog.status', () => Log.getDebugStatus())

    ipcMain.on('diagnostics.renderer.record', (event, value: unknown) => {
      if (!isRendererDiagnostic(value)) return
      if (
        event.sender !== this.window?.webContents &&
        event.sender !== captionWindow.window?.webContents
      ) return
      const source = captionWindow.window?.webContents === event.sender
        ? 'caption-renderer'
        : 'control-renderer'
      if (value.event === 'vue-warning') {
        Log.verbose(source, value.event, {
          message: value.message,
          component: value.component,
          detail: value.detail
        })
        return
      }
      Log.exception(source, value.event, new Error(value.message), {
        stack: value.stack,
        component: value.component,
        detail: value.detail
      })
    })

    ipcMain.handle('control.engine.info', async () => {
      const info: EngineInfo = {
        pid: 0, ppid: 0, port: 0, cpu: 0, mem: 0, elapsed: 0
      }
      if(captionEngine.status !== 'running') return info
      const stats = await pidusage(captionEngine.process.pid)
      info.pid = stats.pid
      info.ppid = stats.ppid
      info.port = captionEngine.port
      info.cpu = stats.cpu
      info.mem = stats.memory
      info.elapsed = stats.elapsed
      return info
    })

    ipcMain.handle('control.hotwords.execute', (_, request) => {
      return hotwordService.execute(request)
    })

    ipcMain.handle('control.appleSpeech.availability', (_, force = false) => {
      return appleSpeechService.availability(force === true)
    })

    ipcMain.handle('control.appleSpeech.modelStatus', (_, locale) => {
      return appleSpeechService.modelStatus(locale)
    })

    ipcMain.handle('control.appleSpeech.installModel', (_, locale) => {
      return appleSpeechService.installModel(locale)
    })

    ipcMain.handle('control.appleSpeech.releaseModel', (_, locale) => {
      return appleSpeechService.releaseModel(locale)
    })

    ipcMain.on('control.application.change', (_, args) => {
      const previousDebugMode = allConfig.application.diagnostics.debugMode
      let changed = false
      if (!this.applyConfig('application', () => {
        changed = allConfig.setApplication(args)
      })) return
      if (!changed) return
      const nextDebugMode = allConfig.application.diagnostics.debugMode
      if (nextDebugMode !== previousDebugMode) {
        diagnosticsCoordinator.setEnabled(nextDebugMode)
        Log.verbose('debug-mode', 'configuration-snapshot', allConfig.config)
        captionEngine.setDebugMode(nextDebugMode)
      }
      if (captionWindow.window) {
        captionWindow.window.webContents.send(
          'both.application.set',
          allConfig.application
        )
      }
    })

    ipcMain.on('control.captionConfig.change', (_, args) => {
      if (!this.applyConfig('caption', () => {
        allConfig.setCaption(args)
      })) return
      if(captionWindow.window) {
        allConfig.sendCaption(captionWindow.window)
      }
    })

    ipcMain.on('control.captionConfig.reset', () => {
      allConfig.resetCaptionStyles()
      if(this.window) {
        allConfig.sendCaption(this.window)
      }
      if(captionWindow.window) {
        allConfig.sendCaption(captionWindow.window)
      }
    })

    ipcMain.on('control.captionWindow.activate', () => {
      if(!captionWindow.window){
        captionWindow.createWindow()
      }
      else {
        captionWindow.window.show()
      }
    })

    ipcMain.on('control.engineConfig.change', (_, args) => {
      this.applyConfig('engine', () => {
        allConfig.setEngine(args)
      })
    })

    ipcMain.handle('control.engine.start', async (): Promise<AppleSpeechStartResult> => {
      if (getActiveBuiltinProvider(allConfig.engine) === 'apple_speech') {
        const availability = await appleSpeechService.availability(true)
        if (availability.state !== 'available') {
          return { accepted: false, reason: availability.reason, availability }
        }
        const modelStatus = await appleSpeechService.modelStatus(
          allConfig.engine.common.sourceLanguage
        )
        if (modelStatus.state !== 'installed') {
          return {
            accepted: false,
            reason: modelStatus.state === 'failed' ? 'status_failed' : 'model_not_installed',
            availability,
            modelStatus
          }
        }
      }
      captionEngine.start()
      return { accepted: true }
    })

    ipcMain.on('control.engine.stop', () => {
      captionEngine.stop()
    })

    ipcMain.on('control.engine.forceKill', () => {
      captionEngine.kill()
    })

    ipcMain.on('control.captionLog.clear', () => {
      allConfig.clearCaptionLog()
    })
  }

  public sendErrorMessage(message: string) {
    this.window?.webContents.send('control.error.occurred', message)
  }

  private applyConfig(label: string, action: () => void): boolean {
    try {
      action()
      return true
    }
    catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError'
      Log.warn(`Rejected invalid ${label} config (${name})`)
      return false
    }
  }
}

export const controlWindow = new ControlWindow()

function isRendererDiagnostic(value: unknown): value is {
  event: string
  message: string
  stack?: string
  component?: string
  detail?: unknown
} {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.event === 'string' && record.event.length <= 128 &&
    typeof record.message === 'string' && record.message.length <= 65536 &&
    (record.stack === undefined || (
      typeof record.stack === 'string' && record.stack.length <= 262144
    )) &&
    (record.component === undefined || (
      typeof record.component === 'string' && record.component.length <= 256
    )) && isRendererDiagnosticDetail(record.detail)
}

function isRendererDiagnosticDetail(value: unknown, depth = 0): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.length <= 65536
  if (typeof value === 'number' || typeof value === 'boolean') return true
  if (depth >= 4 || typeof value !== 'object') return false
  if (Array.isArray(value)) {
    return value.length <= 64 && value.every(
      (item) => isRendererDiagnosticDetail(item, depth + 1)
    )
  }
  const entries = Object.entries(value)
  return entries.length <= 64 && entries.every(([key, child]) => (
    key.length <= 256 && isRendererDiagnosticDetail(child, depth + 1)
  ))
}
