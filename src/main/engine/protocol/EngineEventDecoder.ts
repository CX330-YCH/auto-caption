import { StringDecoder } from 'node:string_decoder'

export type EngineProtocolDecodeErrorKind = 'invalid-json' | 'line-too-long'

export interface EngineProtocolDecodeError {
  kind: EngineProtocolDecodeErrorKind
  lineNumber: number
  message: string
}

export interface EngineProtocolDecodeBatch {
  messages: EngineDecodedValue[]
  errors: EngineProtocolDecodeError[]
}

export interface EngineDecodedValue {
  lineNumber: number
  value: unknown
}

const DEFAULT_MAX_LINE_LENGTH = 1024 * 1024

export class EngineEventDecoder {
  private textDecoder = new StringDecoder('utf8')
  private pending = ''
  private discardingOversizedLine = false
  private lineNumber = 0
  private readonly maxLineLength: number

  constructor(maxLineLength = DEFAULT_MAX_LINE_LENGTH) {
    if (!Number.isInteger(maxLineLength) || maxLineLength <= 0) {
      throw new RangeError('maxLineLength must be a positive integer')
    }
    this.maxLineLength = maxLineLength
  }

  public push(chunk: Buffer | string): EngineProtocolDecodeBatch {
    const text = typeof chunk === 'string' ? chunk : this.textDecoder.write(chunk)
    return this.consume(text, false)
  }

  public finish(): EngineProtocolDecodeBatch {
    return this.consume(this.textDecoder.end(), true)
  }

  public reset(): void {
    this.textDecoder = new StringDecoder('utf8')
    this.pending = ''
    this.discardingOversizedLine = false
    this.lineNumber = 0
  }

  private consume(text: string, final: boolean): EngineProtocolDecodeBatch {
    const batch: EngineProtocolDecodeBatch = { messages: [], errors: [] }
    let remaining = text

    if (this.discardingOversizedLine) {
      const newlineIndex = remaining.indexOf('\n')
      if (newlineIndex === -1) {
        if (final) this.discardingOversizedLine = false
        return batch
      }
      remaining = remaining.slice(newlineIndex + 1)
      this.discardingOversizedLine = false
    }

    this.pending += remaining
    let newlineIndex = this.pending.indexOf('\n')
    while (newlineIndex !== -1) {
      const line = this.pending.slice(0, newlineIndex)
      this.pending = this.pending.slice(newlineIndex + 1)
      this.decodeLine(line, batch)
      newlineIndex = this.pending.indexOf('\n')
    }

    if (Buffer.byteLength(this.pending, 'utf8') > this.maxLineLength) {
      this.lineNumber += 1
      batch.errors.push({
        kind: 'line-too-long',
        lineNumber: this.lineNumber,
        message: `Engine protocol line exceeded ${this.maxLineLength} bytes`
      })
      this.pending = ''
      this.discardingOversizedLine = true
    }

    if (final && !this.discardingOversizedLine && this.pending.length > 0) {
      this.decodeLine(this.pending, batch)
      this.pending = ''
    }

    if (final) this.discardingOversizedLine = false
    return batch
  }

  private decodeLine(lineWithOptionalCarriageReturn: string, batch: EngineProtocolDecodeBatch): void {
    this.lineNumber += 1
    const line = lineWithOptionalCarriageReturn.endsWith('\r')
      ? lineWithOptionalCarriageReturn.slice(0, -1)
      : lineWithOptionalCarriageReturn

    if (!line.trim()) return
    if (Buffer.byteLength(line, 'utf8') > this.maxLineLength) {
      batch.errors.push({
        kind: 'line-too-long',
        lineNumber: this.lineNumber,
        message: `Engine protocol line exceeded ${this.maxLineLength} bytes`
      })
      return
    }

    try {
      batch.messages.push({
        lineNumber: this.lineNumber,
        value: JSON.parse(line)
      })
    } catch {
      batch.errors.push({
        kind: 'invalid-json',
        lineNumber: this.lineNumber,
        message: 'Line is not valid JSON'
      })
    }
  }
}
