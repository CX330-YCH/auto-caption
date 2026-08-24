import { createHash } from 'node:crypto'
import type { EngineMessage } from './messages.ts'

const MAX_DIAGNOSTIC_BYTES = 32 * 1024 * 1024
const MAX_DIAGNOSTIC_CHUNKS = 256
const MAX_ENCODED_DIAGNOSTIC_LENGTH = Math.ceil(MAX_DIAGNOSTIC_BYTES / 3) * 4
const MAX_PENDING_DIAGNOSTICS = 16

interface PendingDiagnostic {
  count: number
  chunks: Array<string | undefined>
  received: number
  encodedLength: number
}

export class EngineDiagnosticAssembler {
  private readonly pending = new Map<string, PendingDiagnostic>()

  public reset(): void {
    this.pending.clear()
  }

  public accept(message: EngineMessage): EngineMessage | null {
    if (message.command === 'diagnostic_chunk') {
      this.acceptChunk(message)
      return null
    }
    if (message.command !== 'error') return message
    const reference = message.diagnostic_ref
    if (!isRecord(reference) || typeof reference.id !== 'string') {
      return message
    }
    const diagnostic = this.resolve(reference)
    return diagnostic === undefined
      ? { ...message, diagnostic_incomplete: reference }
      : { ...message, diagnostic }
  }

  private acceptChunk(message: EngineMessage): void {
    if (
      typeof message.id !== 'string' ||
      !Number.isInteger(message.index) ||
      !Number.isInteger(message.count) ||
      typeof message.content !== 'string'
    ) return
    const index = message.index as number
    const count = message.count as number
    if (
      count <= 0 || count > MAX_DIAGNOSTIC_CHUNKS ||
      index < 0 || index >= count
    ) return
    let item = this.pending.get(message.id)
    if (!item || item.count !== count) {
      if (!item && this.pending.size >= MAX_PENDING_DIAGNOSTICS) {
        const oldestId = this.pending.keys().next().value
        if (typeof oldestId === 'string') this.pending.delete(oldestId)
      }
      item = {
        count,
        chunks: new Array<string | undefined>(count),
        received: 0,
        encodedLength: 0
      }
      this.pending.set(message.id, item)
    }
    const previous = item.chunks[index]
    item.encodedLength += message.content.length - (previous?.length ?? 0)
    if (item.encodedLength > MAX_ENCODED_DIAGNOSTIC_LENGTH) {
      this.pending.delete(message.id)
      return
    }
    if (previous === undefined) item.received += 1
    item.chunks[index] = message.content
  }

  private resolve(reference: Record<string, unknown>): unknown | undefined {
    const id = reference.id as string
    const item = this.pending.get(id)
    this.pending.delete(id)
    if (!item || item.received !== item.count) return undefined
    const encoded = item.chunks.join('')
    const bytes = Buffer.from(encoded, 'base64')
    if (bytes.length > MAX_DIAGNOSTIC_BYTES) return undefined
    if (
      typeof reference.bytes === 'number' &&
      reference.bytes !== bytes.length
    ) return undefined
    if (typeof reference.sha256 === 'string') {
      const digest = createHash('sha256').update(bytes).digest('hex')
      if (digest !== reference.sha256) return undefined
    }
    try {
      return JSON.parse(bytes.toString('utf8'))
    }
    catch {
      return undefined
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
