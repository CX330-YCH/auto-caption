import type {
  EngineConfig,
  KnownProviderName
} from '../../../shared/config/schema.ts'

type ProviderArgumentBuilder = (config: EngineConfig) => string[]

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
  }
}

export function buildBundledEngineArguments(
  config: EngineConfig,
  port: number
): string[] {
  const args = [
    '-a', config.common.audioSource === 1 ? '1' : '0'
  ]
  if (config.common.recording.enabled) {
    args.push('-r', '1')
    args.push('-rp', quotePath(config.common.recording.path))
  }
  args.push('-p', port.toString())
  args.push(
    '-t',
    config.common.translation.enabled
      ? config.common.targetLanguage
      : 'none'
  )
  args.push(...providerArgumentBuilders[config.provider](config))
  return args
}

export function buildCustomEngineArguments(
  config: EngineConfig,
  port: number
): string[] {
  return [
    ...config.custom.command.split(' '),
    '-p',
    port.toString()
  ]
}

function translationArguments(config: EngineConfig): string[] {
  const translation = config.common.translation
  const args = [
    '-tm', translation.provider,
    '-omn', translation.model
  ]
  if (translation.url) args.push('-ourl', translation.url)
  if (translation.apiKey) args.push('-okey', translation.apiKey)
  return args
}

function quotePath(value: string): string {
  return `"${value}"`
}
