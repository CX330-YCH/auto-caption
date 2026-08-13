import * as fs from 'node:fs'
import * as path from 'node:path'

export type DebugLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
export type VisibleLogLevel = Exclude<DebugLogLevel, 'DEBUG'>

export interface DebugLogRecord {
  sequence: number
  timestamp: string
  level: DebugLogLevel
  source: string
  message: string
  fields?: unknown[]
}

export function persistAndRouteLogRecord(
  session: DebugLogSession,
  record: DebugLogRecord,
  expose: (level: VisibleLogLevel) => void
): void {
  session.append(record)
  if (isVisibleLogLevel(record.level)) expose(record.level)
}

export function isVisibleLogLevel(
  level: DebugLogLevel
): level is VisibleLogLevel {
  return level !== 'DEBUG'
}

export class DebugLogSession {
  private filePath: string | undefined
  private readonly pending: DebugLogRecord[] = []

  public initialize(
    userDataPath: string,
    sessionStartedAt: Date = new Date()
  ): string {
    if (this.filePath) return this.filePath
    const directory = path.join(userDataPath, 'debug-logs')
    fs.mkdirSync(directory, { recursive: true })
    const timestamp = sessionStartedAt.toISOString().replace(/[:.]/g, '-')
    this.filePath = path.join(directory, `debug-${timestamp}.jsonl`)
    fs.writeFileSync(this.filePath, '')
    for (const record of this.pending) this.appendToFile(record)
    this.pending.length = 0
    return this.filePath
  }

  public append(record: DebugLogRecord): void {
    if (!this.filePath) {
      this.pending.push(record)
      return
    }
    this.appendToFile(record)
  }

  public exportTo(targetPath: string): boolean {
    if (!this.filePath) return false
    fs.copyFileSync(this.filePath, targetPath)
    return true
  }

  public get path(): string | undefined {
    return this.filePath
  }

  private appendToFile(record: DebugLogRecord): void {
    if (!this.filePath) return
    fs.appendFileSync(this.filePath, `${JSON.stringify(record)}\n`)
  }
}
