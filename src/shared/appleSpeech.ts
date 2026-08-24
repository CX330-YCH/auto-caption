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
  systemInstalled: boolean
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

export type AppleSpeechReadiness =
  | 'unknown'
  | 'checking'
  | 'needs_download'
  | 'needs_activation'
  | 'preparing'
  | 'ready'
  | 'unsupported'
  | 'failed'

export function normalizeAppleSpeechLocale(locale: string): string {
  const bcp47 = locale.trim().replaceAll('_', '-')
  try {
    return Intl.getCanonicalLocales(bcp47)[0] ?? bcp47
  }
  catch {
    return bcp47
  }
}

export function appleSpeechLocalesEqual(left: string, right: string): boolean {
  return normalizeAppleSpeechLocale(left) === normalizeAppleSpeechLocale(right)
}

export function getAppleSpeechReadiness(
  status: AppleSpeechModelStatus
): AppleSpeechReadiness {
  switch (status.state) {
  case 'unknown': return 'unknown'
  case 'checking': return 'checking'
  case 'supported': return status.systemInstalled ? 'needs_activation' : 'needs_download'
  case 'downloading': return 'preparing'
  case 'installed': return 'ready'
  case 'unsupported': return 'unsupported'
  case 'failed': return 'failed'
  }
}
