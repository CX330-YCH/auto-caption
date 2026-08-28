import type {
  CustomEngineConfig,
  EngineConfig,
  KnownProviderName
} from '../../../shared/config/schema.ts'

type ProviderArgumentBuilder = (config: EngineConfig, appleSpeechHelperPath?: string) => string[]

const providerArgumentBuilders: Record<
  KnownProviderName,
  ProviderArgumentBuilder
> = {
  gummy: (config) => {
    const args = [
      '-e', 'gummy',
      '-s', config.common.sourceLanguage
    ]
    if (config.providers.gummy.apiKey) {
      args.push('-k', config.providers.gummy.apiKey)
    }
    return args
  },
  vosk: (config) => [
    '-e', 'vosk',
    '-vosk', quotePath(config.providers.vosk.modelPath),
    ...translationArguments(config)
  ],
  sosv: (config) => [
    '-e', 'sosv',
    '-s', config.common.sourceLanguage,
    '-sosv', quotePath(config.providers.sosv.modelPath),
    ...translationArguments(config)
  ],
  glm: (config) => {
    const args = [
      '-e', 'glm',
      '-s', config.common.sourceLanguage,
      '-gurl', config.providers.glm.url,
      '-gmodel', config.providers.glm.model
    ]
    if (config.providers.glm.apiKey) {
      args.push('-gkey', config.providers.glm.apiKey)
    }
    args.push(...translationArguments(config))
    return args
  },
  fun_asr: (config) => {
    const funAsr = config.providers.funAsr
    const args = [
      '-e', 'fun_asr',
      '-s', config.common.sourceLanguage,
      '-fmodel', funAsr.model,
      '-furl', funAsr.websocketUrl,
      '-fworkspace', funAsr.workspaceId,
      '-fsemantic', funAsr.semanticPunctuationEnabled ? '1' : '0',
      '-fsilence', funAsr.maxSentenceSilenceMs.toString(),
      '-fheartbeat', funAsr.heartbeatEnabled ? '1' : '0',
      '-fvmodel', funAsr.hotwords.targetModel
    ]
    if (funAsr.hotwords.vocabularyId) {
      args.push('-fvocabulary', funAsr.hotwords.vocabularyId)
    }
    for (const term of funAsr.hotwords.contextTerms) {
      args.push('-fcontext', term)
    }
    if (funAsr.apiKey) args.push('-fkey', funAsr.apiKey)
    args.push(...translationArguments(config))
    return args
  },
  apple_speech: (config, helperPath) => {
    if (!helperPath) throw new Error('Apple Speech helper path is required')
    return [
      '-e', 'apple_speech',
      '-s', config.common.sourceLanguage,
      '-ash', helperPath,
      ...translationArguments(config)
    ]
  }
}

export function buildBundledEngineArguments(
  config: EngineConfig,
  provider: KnownProviderName,
  port: number,
  appleSpeechHelperPath?: string,
  debugMode = false
): string[] {
  const args = [
    '-a', config.common.audioSource === 1 ? '1' : '0'
  ]
  if (config.common.recording.enabled) {
    args.push('-r', '1')
    args.push('-rp', quotePath(config.common.recording.path))
  }
  args.push('-p', port.toString())
  args.push('--debug-mode', debugMode ? '1' : '0')
  args.push(
    '-t',
    config.translation.enabled
      ? config.translation.common.targetLanguage
      : 'none'
  )
  args.push(...providerArgumentBuilders[provider](config, appleSpeechHelperPath))
  return args
}

export function buildCustomEngineArguments(
  customEngine: CustomEngineConfig,
  port: number
): string[] {
  return [
    ...customEngine.command.split(' ').filter(Boolean),
    '-p',
    port.toString()
  ]
}

function translationArguments(config: EngineConfig): string[] {
  const translation = config.translation
  if (!translation.enabled) return []
  if (translation.activeProviderId === 'azure') {
    throw new Error('Azure translation is not available in this version')
  }
  const ollama = translation.providers.ollama
  const args = [
    '-tm', translation.activeProviderId,
    '-omn', translation.activeProviderId === 'ollama' ? ollama.model : ''
  ]
  if (translation.activeProviderId === 'ollama' && ollama.url) {
    args.push('-ourl', ollama.url)
  }
  if (translation.activeProviderId === 'ollama' && ollama.apiKey) {
    args.push('-okey', ollama.apiKey)
  }
  return args
}

function quotePath(value: string): string {
  return `"${value}"`
}
