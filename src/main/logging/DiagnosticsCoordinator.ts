import { app, type BrowserWindow } from 'electron'
import { Log } from '../utils/Log.ts'

type WindowSource = 'control-renderer' | 'caption-renderer'

class DiagnosticsCoordinator {
  private installed = false
  private metricsTimer: NodeJS.Timeout | undefined

  public install(): void {
    if (this.installed) return
    this.installed = true

    process.on('uncaughtExceptionMonitor', (error, origin) => {
      Log.exception('electron.process', 'uncaught-exception', error, { origin })
    })
    process.on('unhandledRejection', (reason) => {
      Log.exception('electron.process', 'unhandled-rejection', reason)
    })
    process.on('warning', (warning) => {
      Log.exception('electron.process', 'warning', warning)
    })
    app.on('child-process-gone', (_event, details) => {
      Log.exception('electron.process', 'child-process-gone', details)
    })
  }

  public setEnabled(enabled: boolean): void {
    Log.setDebugMode(enabled)
    if (enabled) this.startMetrics()
    else this.stopMetrics()
  }

  public attachWindow(window: BrowserWindow, source: WindowSource): void {
    window.on('unresponsive', () => {
      Log.exception(source, 'window-unresponsive', new Error('Renderer window is unresponsive'))
    })
    window.on('responsive', () => {
      Log.verbose(source, 'window-responsive', { windowId: window.id })
    })
    window.webContents.on('render-process-gone', (_event, details) => {
      Log.exception(source, 'render-process-gone', details, { windowId: window.id })
    })
    window.webContents.on('preload-error', (_event, preloadPath, error) => {
      Log.exception(source, 'preload-error', error, { preloadPath, windowId: window.id })
    })
    window.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        Log.exception(source, 'did-fail-load', new Error(errorDescription), {
          errorCode,
          validatedURL,
          isMainFrame,
          windowId: window.id
        })
      }
    )
    window.webContents.on(
      'console-message',
      (_event, level, message, lineNumber, sourceId) => {
        Log.verbose(source, 'console-message', {
          windowId: window.id,
          level,
          message,
          lineNumber,
          sourceId
        })
      }
    )
  }

  public stop(): void {
    this.stopMetrics()
  }

  private startMetrics(): void {
    if (this.metricsTimer) return
    this.captureProcessMetrics()
    this.metricsTimer = setInterval(() => this.captureProcessMetrics(), 1000)
    this.metricsTimer.unref()
  }

  private stopMetrics(): void {
    if (!this.metricsTimer) return
    clearInterval(this.metricsTimer)
    this.metricsTimer = undefined
  }

  private captureProcessMetrics(): void {
    Log.metric('electron.process', 'snapshot', {
      main: {
        pid: process.pid,
        memory: process.memoryUsage(),
        resourceUsage: process.resourceUsage(),
        uptimeSeconds: process.uptime()
      },
      processes: app.getAppMetrics()
    })
  }
}

export const diagnosticsCoordinator = new DiagnosticsCoordinator()
