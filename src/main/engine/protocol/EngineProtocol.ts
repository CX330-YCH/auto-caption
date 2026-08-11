import {
  EngineEventDecoder,
  type EngineProtocolDecodeError
} from './EngineEventDecoder.ts'
import { isEngineMessage, type EngineMessage } from './messages.ts'

export type EngineProtocolErrorKind =
  | EngineProtocolDecodeError['kind']
  | 'invalid-message'

export interface EngineProtocolError {
  kind: EngineProtocolErrorKind
  lineNumber: number
  message: string
}

export interface EngineProtocolBatch {
  messages: EngineMessage[]
  errors: EngineProtocolError[]
}

/**
 * Owns the wire format between Electron and a caption engine.
 * Business event dispatch and process lifecycle deliberately stay outside it.
 */
export class EngineProtocol {
  private readonly eventDecoder: EngineEventDecoder

  constructor(maxLineLength?: number) {
    this.eventDecoder = new EngineEventDecoder(maxLineLength)
  }

  public push(chunk: Buffer | string): EngineProtocolBatch {
    return this.validate(this.eventDecoder.push(chunk))
  }

  public finish(): EngineProtocolBatch {
    return this.validate(this.eventDecoder.finish())
  }

  public reset(): void {
    this.eventDecoder.reset()
  }

  public encodeCommand(command: string, content: string = ''): string {
    return `${JSON.stringify({ command, content })}\n`
  }

  private validate(batch: ReturnType<EngineEventDecoder['push']>): EngineProtocolBatch {
    const result: EngineProtocolBatch = {
      messages: [],
      errors: [...batch.errors]
    }

    for (const decoded of batch.messages) {
      if (isEngineMessage(decoded.value)) {
        result.messages.push(decoded.value)
      }
      else {
        result.errors.push({
          kind: 'invalid-message',
          lineNumber: decoded.lineNumber,
          message: 'Message must be a JSON object with a string command'
        })
      }
    }

    return result
  }
}
