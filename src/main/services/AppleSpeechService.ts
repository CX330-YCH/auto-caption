import { BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { StringDecoder } from 'node:string_decoder'
import type {
  AppleSpeechAvailability,
  AppleSpeechModelProgress,
  AppleSpeechModelStatus
} from '../../shared/appleSpeech.ts'
import { resolveAppleSpeechHelperPath } from '../engine/AppleSpeechHelperPath.ts'
import { staticAppleSpeechAvailability } from '../engine/AppleSpeechAvailability.ts'
import { Log } from '../utils/Log.ts'

interface HelperEnvelope {
  protocolVersion: number
  type: string
  payload: Record<string, unknown>
}

const HELPER_PROTOCOL_VERSION = 1
const PROBE_TIMEOUT_MS = 10_000

export class AppleSpeechService {
  private availabilityCache: AppleSpeechAvailability | undefined
  private installOperationId: string | undefined

  public async availability(force = false): Promise<AppleSpeechAvailability> {
    if (!force && this.availabilityCache) return this.availabilityCache
    const osVersion = process.platform === 'darwin' ? process.getSystemVersion() : ''
    const helperPath = resolveAppleSpeechHelperPath()
    const staticResult = staticAppleSpeechAvailability(
      process.platform,
      osVersion,
      helperPath !== undefined
    )
    if (staticResult) {
      if (staticResult.state !== 'hidden') this.availabilityCache = staticResult
      return staticResult
    }
    if (!helperPath) return this.cacheDisabled('helper_missing', osVersion)
    try {
      const envelope = await this.runSingle(helperPath, ['probe'], PROBE_TIMEOUT_MS)
      if (envelope.type !== 'capability') return this.cacheDisabled('helper_incompatible', osVersion)
      const supportedLocales = stringArray(envelope.payload.supportedLocales)
      const result: AppleSpeechAvailability = {
        state: envelope.payload.isAvailable === true && supportedLocales.length > 0 ? 'available' : 'disabled',
        reason: envelope.payload.isAvailable !== true
          ? 'speech_unavailable'
          : supportedLocales.length === 0 ? 'no_supported_locales' : undefined,
        osVersion,
        supportedLocales,
        installedLocales: stringArray(envelope.payload.installedLocales),
        reservedLocales: stringArray(envelope.payload.reservedLocales),
        maximumReservedLocales: finiteNumber(envelope.payload.maximumReservedLocales) ?? 0
      }
      this.availabilityCache = result
      return result
    }
    catch (error) {
      Log.warn('Apple Speech capability probe failed', error)
      return this.cacheDisabled('probe_failed', osVersion)
    }
  }

  public async modelStatus(locale: unknown): Promise<AppleSpeechModelStatus> {
    const normalizedLocale = validateLocale(locale)
    const availability = await this.availability()
    if (availability.state !== 'available') {
      return {
        locale: normalizedLocale,
        state: 'failed',
        reservedLocales: availability.reservedLocales,
        maximumReservedLocales: availability.maximumReservedLocales,
        errorCode: availability.reason ?? 'unavailable'
      }
    }
    const helperPath = resolveAppleSpeechHelperPath()
    if (!helperPath) throw new Error('Apple Speech helper is missing')
    try {
      const envelope = await this.runSingle(
        helperPath,
        ['model-status', '--locale', normalizedLocale],
        PROBE_TIMEOUT_MS
      )
      if (envelope.type !== 'model-status') throw new Error('Unexpected helper response')
      return parseModelStatus(envelope.payload, normalizedLocale)
    }
    catch (error) {
      Log.warn('Apple Speech model status check failed', error)
      return {
        locale: normalizedLocale,
        state: 'failed',
        reservedLocales: availability.reservedLocales,
        maximumReservedLocales: availability.maximumReservedLocales,
        errorCode: 'status_failed'
      }
    }
  }

  public async installModel(locale: unknown): Promise<{ accepted: boolean; operationId?: string; reason?: string }> {
    const normalizedLocale = validateLocale(locale)
    if (this.installOperationId) return { accepted: false, reason: 'busy' }
    const availability = await this.availability()
    if (availability.state !== 'available') return { accepted: false, reason: availability.reason }
    const helperPath = resolveAppleSpeechHelperPath()
    if (!helperPath) return { accepted: false, reason: 'helper_missing' }
    const operationId = randomUUID()
    this.installOperationId = operationId
    void this.runStreaming(helperPath, ['model-install', '--locale', normalizedLocale], (envelope) => {
      if (envelope.type !== 'model-progress') return
      const status = parseModelProgress(envelope.payload, normalizedLocale, operationId)
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('control.appleSpeech.modelProgress', status)
      }
    }).catch((error) => {
      Log.error('Apple Speech model installation failed', error)
      const status: AppleSpeechModelProgress = {
        operationId,
        locale: normalizedLocale,
        state: 'failed',
        reservedLocales: [],
        maximumReservedLocales: 0,
        errorCode: 'install_failed'
      }
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('control.appleSpeech.modelProgress', status)
      }
    }).finally(() => {
      this.installOperationId = undefined
      this.availabilityCache = undefined
    })
    return { accepted: true, operationId }
  }

  public async releaseModel(locale: unknown): Promise<AppleSpeechModelStatus> {
    const normalizedLocale = validateLocale(locale)
    const helperPath = resolveAppleSpeechHelperPath()
    if (!helperPath) throw new Error('Apple Speech helper is missing')
    const envelope = await this.runSingle(
      helperPath,
      ['model-release', '--locale', normalizedLocale],
      PROBE_TIMEOUT_MS
    )
    this.availabilityCache = undefined
    if (envelope.type !== 'model-status') throw new Error('Unexpected helper response')
    return parseModelStatus(envelope.payload, normalizedLocale)
  }

  private cacheDisabled(reason: AppleSpeechAvailability['reason'], osVersion: string): AppleSpeechAvailability {
    const result: AppleSpeechAvailability = {
      state: 'disabled', reason, osVersion,
      supportedLocales: [], installedLocales: [], reservedLocales: [], maximumReservedLocales: 0
    }
    this.availabilityCache = result
    return result
  }

  private async runSingle(executable: string, args: string[], timeoutMs: number): Promise<HelperEnvelope> {
    let result: HelperEnvelope | undefined
    await this.runStreaming(executable, args, (envelope) => { result = envelope }, timeoutMs)
    if (!result) throw new Error('Apple Speech helper returned no response')
    return result
  }

  private runStreaming(
    executable: string,
    args: string[],
    onEnvelope: (envelope: HelperEnvelope) => void,
    timeoutMs?: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      const decoder = new StringDecoder('utf8')
      let buffer = ''
      let stderr = ''
      let settled = false
      const timer = timeoutMs ? setTimeout(() => {
        child.kill()
        finish(() => reject(new Error('Apple Speech helper timed out')))
      }, timeoutMs) : undefined
      const finish = (action: () => void): void => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        action()
      }
      const parseLines = (text: string, flush = false): void => {
        buffer += text
        const lines = buffer.split(/\r?\n/)
        buffer = flush ? '' : (lines.pop() ?? '')
        for (const line of lines) {
          if (!line.trim()) continue
          const envelope = JSON.parse(line) as HelperEnvelope
          if (envelope.protocolVersion !== HELPER_PROTOCOL_VERSION || typeof envelope.type !== 'string') {
            throw new Error('Incompatible Apple Speech helper protocol')
          }
          if (envelope.type === 'error') throw new Error(String(envelope.payload.code ?? 'helper-error'))
          onEnvelope(envelope)
        }
      }
      child.stdout.on('data', (chunk: Buffer) => {
        try { parseLines(decoder.write(chunk)) }
        catch (error) { child.kill(); finish(() => reject(error)) }
      })
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8').slice(0, 4096) })
      child.once('error', (error) => finish(() => reject(error)))
      child.once('close', (code) => {
        try { parseLines(decoder.end(), true) }
        catch (error) { finish(() => reject(error)); return }
        if (code === 0) finish(resolve)
        else finish(() => reject(new Error(`Apple Speech helper exited with ${code}: ${stderr.trim()}`)))
      })
    })
  }
}

function validateLocale(value: unknown): string {
  if (typeof value !== 'string' || value.length < 2 || value.length > 64 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new TypeError('Invalid Apple Speech locale')
  }
  return value
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseModelStatus(payload: Record<string, unknown>, fallbackLocale: string): AppleSpeechModelStatus {
  const state = payload.state
  return {
    locale: typeof payload.locale === 'string' ? payload.locale : fallbackLocale,
    state: state === 'supported' || state === 'downloading' || state === 'installed' || state === 'unsupported' || state === 'failed' ? state : 'failed',
    reservedLocales: stringArray(payload.reservedLocales),
    maximumReservedLocales: finiteNumber(payload.maximumReservedLocales) ?? 0
  }
}

function parseModelProgress(
  payload: Record<string, unknown>,
  fallbackLocale: string,
  operationId: string
): AppleSpeechModelProgress {
  const status = parseModelStatus({ ...payload, state: payload.phase }, fallbackLocale)
  return { ...status, operationId, fractionCompleted: finiteNumber(payload.fractionCompleted) }
}

export const appleSpeechService = new AppleSpeechService()
