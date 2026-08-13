import { controlWindow } from "../ControlWindow"
import { type SoftwareLogItem } from "../types"
import {
  DebugLogSession,
  type DebugLogLevel,
  persistAndRouteLogRecord
} from '../logging/DebugLogSession'
import { redactSensitiveValue } from './UtilsFunc'

let logIndex = 0
let debugSequence = 0
const logQueue: SoftwareLogItem[] = []
const debugSession = new DebugLogSession()

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

  static getDebugSessionPath(): string | undefined {
    return debugSession.path
  }

  static getAndClearLogQueue(): SoftwareLogItem[] {
    const copiedQueue = structuredClone(logQueue)
    logQueue.length = 0
    return copiedQueue
  }

  static handleLog(logType: DebugLogLevel, ...msg: unknown[]): void {
    const timeStr = getTimeString()
    const logPre = `[${logType} ${timeStr}]`
    const redacted = msg.map((value) => redactSensitiveValue(value))
    const logStr = redacted.map((value) => (
      typeof value === 'string' ? value : JSON.stringify(value, undefined, 2)
    )).join(' ')
    persistAndRouteLogRecord(debugSession, {
      sequence: ++debugSequence,
      timestamp: new Date().toISOString(),
      level: logType,
      source: 'electron-main',
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
