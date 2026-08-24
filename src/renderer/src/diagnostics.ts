import type { App } from 'vue'

interface RendererDiagnostic {
  event: string
  message: string
  stack?: string
  component?: string
  detail?: unknown
}

function sendDiagnostic(diagnostic: RendererDiagnostic): void {
  window.electron.ipcRenderer.send('diagnostics.renderer.record', diagnostic)
}

function errorDiagnostic(event: string, value: unknown): RendererDiagnostic {
  if (value instanceof Error) {
    return {
      event,
      message: value.message,
      stack: value.stack,
      detail: value.cause
    }
  }
  return { event, message: String(value) }
}

export function installRendererDiagnostics(app: App): void {
  app.config.errorHandler = (error, instance, info) => {
    sendDiagnostic({
      ...errorDiagnostic('vue-error', error),
      component: instance?.$options.name,
      detail: { info }
    })
    console.error(error)
  }
  app.config.warnHandler = (message, instance, trace) => {
    sendDiagnostic({
      event: 'vue-warning',
      message,
      component: instance?.$options.name,
      detail: { trace }
    })
  }
  window.addEventListener('error', (event) => {
    sendDiagnostic({
      ...errorDiagnostic('window-error', event.error ?? event.message),
      detail: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    sendDiagnostic(errorDiagnostic('unhandled-rejection', event.reason))
  })
}
