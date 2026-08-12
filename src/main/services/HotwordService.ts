import { spawn } from 'child_process'
import type {
  HotwordErrorCode,
  HotwordRequest,
  HotwordResponse
} from '../../shared/hotwords.ts'
import { parseHotwordRequest } from '../../shared/hotwords.ts'
import { resolveBundledEngineCommand } from '../engine/EngineExecutable'
import { allConfig } from '../utils/AllConfig'
import { Log } from '../utils/Log'

const MAX_RESPONSE_BYTES = 1024 * 1024
const REQUEST_TIMEOUT_MS = 20000
const errorCodes = new Set<HotwordErrorCode>([
  'invalid_request',
  'not_configured',
  'key_missing',
  'busy',
  'timeout',
  'process_failed',
  'sdk_error',
  'model_mismatch'
])

export class HotwordService {
  private busy = false

  public async execute(value: unknown): Promise<HotwordResponse> {
    let request: HotwordRequest
    try {
      request = parseHotwordRequest(value)
    }
    catch {
      return failure('invalid_request')
    }
    if (this.busy) return failure('busy')

    const config = allConfig.engine.providers.funAsr
    if (!config.workspaceId || !config.websocketUrl) {
      return failure('not_configured')
    }
    const apiKey = config.apiKey || process.env.DASHSCOPE_API_KEY || ''
    if (!apiKey) return failure('key_missing')

    this.busy = true
    Log.info('Hotword operation started:', request.action)
    try {
      const response = await this.runWorker({
        workspaceId: config.workspaceId,
        websocketUrl: config.websocketUrl,
        model: config.model,
        apiKey,
        request
      })
      Log.info(
        'Hotword operation finished:',
        request.action,
        response.ok ? 'ok' : response.errorCode
      )
      return response
    }
    catch (error) {
      const errorName = error instanceof Error ? error.name : 'UnknownError'
      Log.error(`Hotword operation failed (${errorName})`)
      return failure('process_failed')
    }
    finally {
      this.busy = false
    }
  }

  private runWorker(envelope: Record<string, unknown>): Promise<HotwordResponse> {
    const command = resolveBundledEngineCommand()
    const child = spawn(command.appPath, [
      ...command.prefixArguments,
      '--hotword-service'
    ], { stdio: ['pipe', 'pipe', 'pipe'] })

    return new Promise((resolve) => {
      let stdout = Buffer.alloc(0)
      let settled = false
      const finish = (response: HotwordResponse): void => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        resolve(response)
      }
      const timeout = setTimeout(() => {
        child.kill()
        finish(failure('timeout'))
      }, REQUEST_TIMEOUT_MS)

      child.stdout.on('data', (chunk: Buffer) => {
        if (stdout.length + chunk.length > MAX_RESPONSE_BYTES) {
          child.kill()
          finish(failure('process_failed'))
          return
        }
        stdout = Buffer.concat([stdout, chunk])
      })
      child.stderr.on('data', () => {
        // SDK stderr can contain remote diagnostics; never forward raw text.
      })
      child.on('error', (error) => {
        Log.error(`Hotword worker failed (${error.name})`)
        finish(failure('process_failed'))
      })
      child.stdin.on('error', (error) => {
        Log.error(`Hotword worker input failed (${error.name})`)
        finish(failure('process_failed'))
      })
      child.on('close', () => {
        try {
          finish(parseWorkerResponse(stdout.toString('utf8')))
        }
        catch {
          finish(failure('process_failed'))
        }
      })
      child.stdin.end(JSON.stringify(envelope))
    })
  }
}

function parseWorkerResponse(value: string): HotwordResponse {
  const parsed: unknown = JSON.parse(value.trim())
  if (typeof parsed !== 'object' || parsed === null || !('ok' in parsed)) {
    throw new TypeError('Invalid hotword worker response')
  }
  const response = parsed as Record<string, unknown>
  if (response.ok === true) return { ok: true, data: response.data }
  if (
    response.ok === false &&
    typeof response.errorCode === 'string' &&
    errorCodes.has(response.errorCode as HotwordErrorCode)
  ) {
    return failure(response.errorCode as HotwordErrorCode)
  }
  throw new TypeError('Invalid hotword worker response')
}

function failure(errorCode: HotwordErrorCode): HotwordResponse {
  return { ok: false, errorCode }
}

export const hotwordService = new HotwordService()
