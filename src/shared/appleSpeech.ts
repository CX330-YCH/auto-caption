export const APPLE_SPEECH_PROVIDER = 'apple_speech' as const

export type AppleSpeechAvailabilityState = 'hidden' | 'disabled' | 'available'
export type AppleSpeechDisabledReason =
  | 'unsupported_os'
  | 'helper_missing'
  | 'helper_incompatible'
  | 'speech_unavailable'
  | 'no_supported_locales'
  | 'probe_failed'

export interface AppleSpeechAvailability {
  state: AppleSpeechAvailabilityState
  reason?: AppleSpeechDisabledReason
  osVersion?: string
  supportedLocales: string[]
  installedLocales: string[]
  reservedLocales: string[]
  maximumReservedLocales: number
}

export type AppleSpeechModelState =
  | 'unknown'
  | 'checking'
  | 'supported'
  | 'downloading'
  | 'installed'
  | 'unsupported'
  | 'failed'

export interface AppleSpeechModelStatus {
  locale: string
  state: AppleSpeechModelState
  reservedLocales: string[]
  maximumReservedLocales: number
  fractionCompleted?: number
  errorCode?: string
}

export interface AppleSpeechModelProgress extends AppleSpeechModelStatus {
  operationId: string
}

export interface AppleSpeechStartResult {
  accepted: boolean
  reason?: AppleSpeechDisabledReason | 'model_not_installed' | 'status_failed'
  availability?: AppleSpeechAvailability
  modelStatus?: AppleSpeechModelStatus
}
