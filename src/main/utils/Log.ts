import { controlWindow } from "../ControlWindow"
import { type SoftwareLogItem } from "../types"
import {
  DebugLogSession,
  type DebugLogHealth,
  type DebugLogLevel,
  persistAndRouteLogRecord
} from '../logging/DebugLogSession'
import { redactSensitiveValue } from './UtilsFunc'
import { performance } from 'node:perf_hooks'

let logIndex = 0
let debugSequence = 0
const logQueue: SoftwareLogItem[] = []
const debugSession = new DebugLogSession()
let debugMode = false

function getTimeString(): string {
  const now = new Date()
  const HH = String(now.getHours()).padStart(2, '0')
  const MM = String(now.getMinutes()).padStart(2, '0')
  const SS = String(now.getSeconds()).padStart(2, '0')
  const MS = String(now.getMilliseconds()).padStart(3, '0')
  return `${HH}:${MM}:${SS}.${MS}`
}

export class Log {
  static initialize(userDataPath: string): string {
    return debugSession.initialize(userDataPath)
  }

  static exportDebugSession(targetPath: string): boolean {
    return debugSession.exportTo(targetPath)
  }

  static getDebugStatus(): Omit<DebugLogHealth, 'filePath'> & { enabled: boolean } {
    const health = debugSession.health
    return {
      enabled: debugMode,
      available: health.available,
      writeHealthy: health.writeHealthy,
      sessionId: health.sessionId,
      bytesWritten: health.bytesWritten,
      droppedRecords: health.droppedRecords,
      lastError: health.lastError
    }
  }

  static isDebugModeEnabled(): boolean {
    return debugMode
  }

  static setDebugMode(enabled: boolean): void {
    if (debugMode === enabled) return
    debugMode = enabled
    this.writeRecord('INFO', 'lifecycle', 'debug-mode', 'changed', [
      `Debug Mode ${enabled ? 'enabled' : 'disabled'}`,
      { enabled }
    ])
  }

  static getDebugSessionPath(): string | undefined {
    return debugSession.path
  }

  static getAndClearLogQueue(): SoftwareLogItem[] {
    const copiedQueue = structuredClone(logQueue)
    logQueue.length = 0
    return copiedQueue
  }

  static handleLog(logType: DebugLogLevel, ...msg: unknown[]): void {
    this.writeRecord(logType, 'log', 'application', 'message', msg)
  }

  static verbose(
    category: string,
    event: string,
    ...msg: unknown[]
  ): void {
    if (!debugMode) return
    this.writeRecord('DEBUG', 'log', category, event, msg)
  }

  static metric(
    category: string,
    event: string,
    fields: Record<string, unknown>
  ): void {
    if (!debugMode) return
    this.writeRecord('DEBUG', 'metric', category, event, [fields])
  }

  static protocol(
    category: string,
    event: string,
    fields: Record<string, unknown>
  ): void {
    if (!debugMode) return
    this.writeRecord('DEBUG', 'protocol', category, event, [fields])
  }

  static exception(
    category: string,
    event: string,
    error: unknown,
    fields: Record<string, unknown> = {}
  ): void {
    this.writeRecord('ERROR', 'exception', category, event, [error, fields])
  }

  private static writeRecord(
    logType: DebugLogLevel,
    recordType: 'session' | 'log' | 'exception' | 'metric' | 'protocol' | 'process' | 'lifecycle',
    category: string,
    event: string,
    msg: unknown[]
  ): void {
    const timeStr = getTimeString()
    const logPre = `[${logType} ${timeStr}]`
    const redacted = msg.map((value) => redactSensitiveValue(value))
    const logStr = redacted.map((value) => (
      typeof value === 'string'
        ? value
        : JSON.stringify(value, undefined, 2) ?? String(value)
    )).join(' ')
    persistAndRouteLogRecord(debugSession, {
      sequence: ++debugSequence,
      timestamp: new Date().toISOString(),
      monotonicMs: performance.now(),
      level: logType,
      source: 'electron-main',
      recordType,
      category,
      event,
      message: logStr,
      fields: redacted
    }, (visibleLevel) => {
      console.log(logPre, logStr)
      const logItem: SoftwareLogItem = {
        type: visibleLevel,
        index: ++logIndex,
        time: timeStr,
        text: logStr
      }
      if(controlWindow.mounted && controlWindow.window) {
        controlWindow.window.webContents.send(
          'control.softwareLog.add',
          logItem
        )
      }
      else {
        logQueue.push(logItem)
      }
    })
  }

  static debug(...msg: unknown[]): void {
    this.handleLog("DEBUG", ...msg)
  }

  static info(...msg: unknown[]): void {
    this.handleLog("INFO", ...msg)
  }

  static warn(...msg: unknown[]): void {
    this.handleLog("WARN", ...msg)
  }

  static error(...msg: unknown[]): void {
    this.handleLog("ERROR", ...msg)
  }
}
