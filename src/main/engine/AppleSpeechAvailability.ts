import type { AppleSpeechAvailability } from '../../shared/appleSpeech.ts'

export const APPLE_SPEECH_MINIMUM_MACOS_MAJOR = 26

export function staticAppleSpeechAvailability(
  platform: NodeJS.Platform,
  osVersion: string,
  helperExists: boolean
): AppleSpeechAvailability | undefined {
  const empty = {
    supportedLocales: [],
    installedLocales: [],
    reservedLocales: [],
    maximumReservedLocales: 0
  }
  if (platform !== 'darwin') return { state: 'hidden', ...empty }
  if (Number(osVersion.split('.')[0]) < APPLE_SPEECH_MINIMUM_MACOS_MAJOR) {
    return { state: 'disabled', reason: 'unsupported_os', osVersion, ...empty }
  }
  if (!helperExists) {
    return { state: 'disabled', reason: 'helper_missing', osVersion, ...empty }
  }
  return undefined
}
