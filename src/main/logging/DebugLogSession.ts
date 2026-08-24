import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'

export type DebugLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
export type VisibleLogLevel = Exclude<DebugLogLevel, 'DEBUG'>

export interface DebugLogRecord {
  recordVersion?: 2
  sequence: number
  timestamp: string
  monotonicMs?: number
  level: DebugLogLevel
  source: string
  recordType?: 'session' | 'log' | 'exception' | 'metric' | 'protocol' | 'process' | 'lifecycle'
  category?: string
  event?: string
  sessionId?: string
  engineRunId?: number
  provider?: string
  message: string
  fields?: unknown[]
}

export interface DebugLogHealth {
  available: boolean
  writeHealthy: boolean
  filePath?: string
  sessionId: string
  bytesWritten: number
  droppedRecords: number
  lastError?: string
}

const MAX_PENDING_RECORDS = 1024

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
  private readonly sessionId = randomUUID()
  private bytesWritten = 0
  private droppedRecords = 0
  private writeHealthy = true
  private lastError: string | undefined

  public initialize(
    userDataPath: string,
    sessionStartedAt: Date = new Date()
  ): string {
    if (this.filePath) return this.filePath
    const directory = path.join(userDataPath, 'debug-logs')
    try {
      fs.mkdirSync(directory, { recursive: true })
      const timestamp = sessionStartedAt.toISOString().replace(/[:.]/g, '-')
      const candidatePath = path.join(directory, `debug-${timestamp}.jsonl`)
      fs.writeFileSync(candidatePath, '')
      this.filePath = candidatePath
      for (const record of this.pending) this.appendToFile(record)
      this.pending.length = 0
      return this.filePath
    }
    catch (error) {
      this.markWriteFailure(error)
      return ''
    }
  }

  public append(record: DebugLogRecord): void {
    if (!this.filePath) {
      if (this.pending.length >= MAX_PENDING_RECORDS) {
        this.pending.shift()
        this.droppedRecords += 1
      }
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

  public get health(): DebugLogHealth {
    return {
      available: this.filePath !== undefined,
      writeHealthy: this.writeHealthy,
      filePath: this.filePath,
      sessionId: this.sessionId,
      bytesWritten: this.bytesWritten,
      droppedRecords: this.droppedRecords,
      lastError: this.lastError
    }
  }

  private appendToFile(record: DebugLogRecord): void {
    if (!this.filePath) return
    const line = `${JSON.stringify({
      recordVersion: 2,
      sessionId: this.sessionId,
      ...record
    })}\n`
    try {
      fs.appendFileSync(this.filePath, line)
      this.bytesWritten += Buffer.byteLength(line)
    }
    catch (error) {
      this.markWriteFailure(error)
      if (this.pending.length >= MAX_PENDING_RECORDS) {
        this.pending.shift()
        this.droppedRecords += 1
      }
      this.pending.push(record)
    }
  }

  private markWriteFailure(error: unknown): void {
    this.writeHealthy = false
    this.lastError = error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error)
    try {
      process.stderr.write(`[DebugLogSession] ${this.lastError}\n`)
    }
    catch {
      // There is no further safe logging fallback.
    }
  }
}
