import type {
  CaptionBoundaryMode,
  CaptionDisplayMode,
  Styles
} from '../types'
import {
  CONFIG_SCHEMA_VERSION,
  InvalidConfigError,
  UnsupportedConfigVersionError,
  isKnownProviderName,
  isKnownTranslationProviderName,
  type ApplicationConfig,
  type ConfigDocumentV10,
  type EngineConfig,
  type ProviderConfigs,
  type TranslationConfig
} from './schema.ts'
import {
  isRecord,
  requireBoolean,
  requireColor,
  requireContextTerms,
  requireFunAsrModel,
  requireLanguage,
  requireNumber,
  requireProvider,
  requireString,
  requireTheme,
  requireUrl,
  requireVocabularyId,
  requireWebSocketUrl,
  requireWorkspaceId,
  validateFunAsrEndpoint
} from './validation.ts'
import {
  TENCENT_RECOGNITION_MODELS,
  TENCENT_RECOGNITION_V2_MODELS,
  TENCENT_SPEECH_MODELS,
  isTencentSpeechLanguagePair
} from '../tencentSpeech.ts'

export function parseConfigDocumentV10(value: unknown): ConfigDocumentV10 {
  if (!isRecord(value)) {
    throw new InvalidConfigError('Config root must be an object')
  }
  if (value.schemaVersion === 2) {
    return parseConfigDocumentV10(migrateConfigDocumentV2ToV3(value))
  }
  if (value.schemaVersion === 3) {
    return parseConfigDocumentV10(migrateConfigDocumentV3ToV4(value))
  }
  if (value.schemaVersion === 4) {
    return parseConfigDocumentV10(migrateConfigDocumentV4ToV5(value))
  }
  if (value.schemaVersion === 5) {
    return parseConfigDocumentV10(migrateConfigDocumentV5ToV6(value))
  }
  if (value.schemaVersion === 6) {
    return parseConfigDocumentV10(migrateConfigDocumentV6ToV7(value))
  }
  if (value.schemaVersion === 7) {
    return parseConfigDocumentV10(migrateConfigDocumentV7ToV8(value))
  }
  if (value.schemaVersion === 8) {
    return parseConfigDocumentV10(migrateConfigDocumentV8ToV9(value))
  }
  if (value.schemaVersion === 9) {
    return parseConfigDocumentV10(migrateConfigDocumentV9ToV10(value))
  }
  if (value.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    if (
      typeof value.schemaVersion === 'number' &&
      Number.isFinite(value.schemaVersion)
    ) {
      throw new UnsupportedConfigVersionError(value.schemaVersion)
    }
    throw new InvalidConfigError(
      `Config schemaVersion must be ${CONFIG_SCHEMA_VERSION}`
    )
  }
  return {
    ...value,
    schemaVersion: CONFIG_SCHEMA_VERSION,
    application: parseApplicationConfig(value.application),
    engine: parseEngineConfig(value.engine),
    caption: parseCaptionConfig(value.caption)
  }
}

function migrateConfigDocumentV9ToV10(
  value: Record<string, unknown>
): Record<string, unknown> {
  const engine = requireRecord(value.engine, 'engine')
  const providers = requireRecord(engine.providers, 'engine.providers')
  return {
    ...value,
    schemaVersion: 10,
    engine: {
      ...engine,
      providers: {
        ...providers,
        tencentRecognition: {
          model: '16k_zh_en',
          vadSilenceMs: 1000,
          maxSpeakTimeMs: 60000
        },
        tencentRecognitionV2: {
          model: '16k_zh_en_2.0',
          vadSilenceMs: 1000,
          sentenceStrategy: 0
        }
      }
    }
  }
}

function migrateConfigDocumentV8ToV9(
  value: Record<string, unknown>
): Record<string, unknown> {
  const engine = requireRecord(value.engine, 'engine')
  const providers = requireRecord(engine.providers, 'engine.providers')
  const tencentSpeech = requireRecord(
    providers.tencentSpeech,
    'engine.providers.tencentSpeech'
  )
  return {
    ...value,
    schemaVersion: 9,
    engine: {
      ...engine,
      providers: {
        ...providers,
        tencentSpeech: {
          ...tencentSpeech,
          appId: '',
          secretId: '',
          secretKey: ''
        }
      }
    }
  }
}

function migrateConfigDocumentV7ToV8(
  value: Record<string, unknown>
): Record<string, unknown> {
  const engine = requireRecord(value.engine, 'engine')
  const providers = requireRecord(engine.providers, 'engine.providers')
  return {
    ...value,
    schemaVersion: 8,
    engine: {
      ...engine,
      providers: {
        ...providers,
        tencentSpeech: {
          model: 'hunyuan-translation-lite',
          vadSilenceMs: 1000,
          maxSpeakTimeMs: 10000,
          hotwords: { entries: [] }
        }
      }
    }
  }
}

function migrateConfigDocumentV5ToV6(
  value: Record<string, unknown>
): Record<string, unknown> {
  const application = requireRecord(value.application, 'application')
  const existingDiagnostics = isRecord(application.diagnostics)
    ? application.diagnostics
    : {}
  return {
    ...value,
    schemaVersion: 6,
    application: {
      ...application,
      diagnostics: {
        ...existingDiagnostics,
        debugMode: false
      }
    }
  }
}

function migrateConfigDocumentV6ToV7(
  value: Record<string, unknown>
): Record<string, unknown> {
  const engine = requireRecord(value.engine, 'engine')
  const common = requireRecord(engine.common, 'engine.common')
  const legacyTranslation = requireRecord(
    common.translation,
    'engine.common.translation'
  )
  const provider = requireString(
    legacyTranslation.provider,
    'translation.provider',
    64,
    false
  )
  if (provider !== 'google' && provider !== 'ollama') {
    throw new InvalidConfigError('Invalid translation.provider')
  }

  const migratedCommon: Record<string, unknown> = { ...common }
  delete migratedCommon.targetLanguage
  delete migratedCommon.translation

  const translationExtensions: Record<string, unknown> = {
    ...legacyTranslation
  }
  delete translationExtensions.provider
  delete translationExtensions.model
  delete translationExtensions.url
  delete translationExtensions.apiKey
  delete translationExtensions.enabled

  return {
    ...value,
    schemaVersion: 7,
    engine: {
      ...engine,
      common: migratedCommon,
      translation: {
        ...translationExtensions,
        enabled: legacyTranslation.enabled,
        activeProviderId: provider,
        common: {
          targetLanguage: common.targetLanguage
        },
        providers: {
          azure: {
            endpoint: 'https://api.cognitive.microsofttranslator.com',
            region: '',
            apiKey: ''
          },
          google: {},
          ollama: {
            model: legacyTranslation.model,
            url: legacyTranslation.url,
            apiKey: legacyTranslation.apiKey
          }
        }
      }
    }
  }
}

function migrateConfigDocumentV4ToV5(
  value: Record<string, unknown>
): Record<string, unknown> {
  const caption = requireRecord(value.caption, 'caption')
  const styles = requireRecord(caption.styles, 'caption.styles')
  return {
    ...value,
    schemaVersion: 5,
    caption: {
      ...caption,
      styles: {
        ...styles,
        captionBoundaryMode: 'sentence'
      }
    }
  }
}

export function parseApplicationConfig(value: unknown): ApplicationConfig {
  if (!isRecord(value)) {
    throw new InvalidConfigError('Application config must be an object')
  }
  if (!isRecord(value.layout)) {
    throw new InvalidConfigError('Application layout must be an object')
  }
  if (!isRecord(value.diagnostics)) {
    throw new InvalidConfigError('Application diagnostics must be an object')
  }
  return {
    ...value,
    language: requireLanguage(value.language),
    theme: requireTheme(value.theme),
    accentColor: requireColor(value.accentColor, 'accentColor'),
    layout: {
      ...value.layout,
      leftBarWidth: requireNumber(
        value.layout.leftBarWidth,
        'leftBarWidth',
        6,
        12
      ),
      captionWindowWidth: requireNumber(
        value.layout.captionWindowWidth,
        'captionWindowWidth',
        480,
        10000
      )
    },
    diagnostics: {
      ...value.diagnostics,
      debugMode: requireBoolean(
        value.diagnostics.debugMode,
        'diagnostics.debugMode'
      )
    }
  }
}

export function parseEngineConfig(value: unknown): EngineConfig {
  if (!isRecord(value)) {
    throw new InvalidConfigError('Engine config must be an object')
  }
  if (!isRecord(value.common)) {
    throw new InvalidConfigError('Engine common config must be an object')
  }
  if (!isRecord(value.translation)) {
    throw new InvalidConfigError('Translation config must be an object')
  }
  if (!isRecord(value.common.recording)) {
    throw new InvalidConfigError('Recording config must be an object')
  }
  if (!isRecord(value.providers)) {
    throw new InvalidConfigError('Provider configs must be an object')
  }
  if (!Array.isArray(value.customEngines)) {
    throw new InvalidConfigError('Custom engines config must be an array')
  }
  const audioSource = requireNumber(
    value.common.audioSource,
    'audioSource',
    0,
    1
  )
  const customEngines = parseCustomEngines(value.customEngines)
  const activeEngineId = requireString(value.activeEngineId, 'activeEngineId', 128, false)
  if (
    !isKnownProviderName(activeEngineId) &&
    !customEngines.some((engine) => engine.id === activeEngineId)
  ) {
    throw new InvalidConfigError('Active engine does not exist')
  }
  const sourceLanguage = requireString(
    value.common.sourceLanguage,
    'sourceLanguage',
    32,
    false
  )
  const providers = parseProviderConfigs(value.providers)
  const translation = parseTranslationConfig(value.translation)
  if (activeEngineId === 'tencent_speech_translate') {
    if (!translation.enabled) {
      throw new InvalidConfigError(
        'Tencent speech translation requires translation.enabled'
      )
    }
    if (
      !isTencentSpeechLanguagePair(
        sourceLanguage,
        translation.common.targetLanguage
      )
    ) {
      throw new InvalidConfigError(
        'Unsupported Tencent speech translation language pair'
      )
    }
  }
  return {
    ...value,
    activeEngineId,
    common: {
      ...value.common,
      sourceLanguage,
      audioSource: audioSource as 0 | 1,
      recording: {
        ...value.common.recording,
        enabled: requireBoolean(
          value.common.recording.enabled,
          'recording.enabled'
        ),
        path: requireString(
          value.common.recording.path,
          'recording.path'
        )
      },
      startTimeoutSeconds: requireNumber(
        value.common.startTimeoutSeconds,
        'startTimeoutSeconds',
        10,
        120
      )
    },
    providers,
    translation,
    customEngines
  }
}

function parseTranslationConfig(value: Record<string, unknown>): TranslationConfig {
  const common = requireRecord(value.common, 'translation.common')
  const providers = requireRecord(value.providers, 'translation.providers')
  const azure = requireRecord(providers.azure, 'translation.providers.azure')
  const google = requireRecord(providers.google, 'translation.providers.google')
  const ollama = requireRecord(providers.ollama, 'translation.providers.ollama')
  const activeProviderId = requireString(
    value.activeProviderId,
    'translation.activeProviderId',
    64,
    false
  )
  if (!isKnownTranslationProviderName(activeProviderId)) {
    throw new InvalidConfigError('Invalid translation.activeProviderId')
  }
  return {
    ...value,
    enabled: requireBoolean(value.enabled, 'translation.enabled'),
    activeProviderId,
    common: {
      ...common,
      targetLanguage: requireString(
        common.targetLanguage,
        'translation.common.targetLanguage',
        32,
        false
      )
    },
    providers: {
      ...providers,
      azure: {
        ...azure,
        endpoint: requireUrl(
          azure.endpoint,
          'translation.providers.azure.endpoint',
          false
        ),
        region: requireString(
          azure.region,
          'translation.providers.azure.region',
          256
        ),
        apiKey: requireString(
          azure.apiKey,
          'translation.providers.azure.apiKey',
          8192
        )
      },
      google: { ...google },
      ollama: {
        ...ollama,
        model: requireString(
          ollama.model,
          'translation.providers.ollama.model',
          256
        ),
        url: requireUrl(
          ollama.url,
          'translation.providers.ollama.url'
        ),
        apiKey: requireString(
          ollama.apiKey,
          'translation.providers.ollama.apiKey',
          8192
        )
      }
    }
  }
}

function parseCustomEngines(value: unknown[]): EngineConfig['customEngines'] {
  const engines = value.map((item, index) => {
    const engine = requireRecord(item, `customEngines[${index}]`)
    const id = requireString(engine.id, `customEngines[${index}].id`, 128, false)
    const name = requireString(engine.name, `customEngines[${index}].name`, 64, false).trim()
    if (isKnownProviderName(id) || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      throw new InvalidConfigError(`Invalid customEngines[${index}].id`)
    }
    if (!name) {
      throw new InvalidConfigError(`Invalid customEngines[${index}].name`)
    }
    return {
      ...engine,
      id,
      name,
      executable: requireString(engine.executable, `customEngines[${index}].executable`),
      command: requireString(engine.command, `customEngines[${index}].command`, 16384)
    }
  })
  if (new Set(engines.map(({ id }) => id)).size !== engines.length) {
    throw new InvalidConfigError('Duplicate custom engine id')
  }
  if (new Set(engines.map(({ name }) => name.toLocaleLowerCase())).size !== engines.length) {
    throw new InvalidConfigError('Duplicate custom engine name')
  }
  return engines
}

function migrateConfigDocumentV2ToV3(value: Record<string, unknown>): Record<string, unknown> {
  const engine = requireRecord(value.engine, 'engine')
  const provider = requireProvider(engine.provider)
  const custom = requireRecord(engine.custom, 'custom')
  const customEnabled = requireBoolean(custom.enabled, 'custom.enabled')
  const executable = requireString(custom.executable, 'custom.executable')
  const command = requireString(custom.command, 'custom.command', 16384)
  const migratedCustomEngine: Record<string, unknown> = {
    ...custom,
    id: 'custom-migrated',
    name: 'Custom Engine',
    executable,
    command
  }
  delete migratedCustomEngine.enabled
  const hasCustomExtension = Object.keys(custom).some((key) => {
    return key !== 'enabled' && key !== 'executable' && key !== 'command'
  })
  const migratedEngine: Record<string, unknown> = {
    ...engine,
    activeEngineId: customEnabled ? migratedCustomEngine.id : provider,
    customEngines: customEnabled || executable || command || hasCustomExtension
      ? [migratedCustomEngine]
      : []
  }
  delete migratedEngine.provider
  delete migratedEngine.custom
  return {
    ...value,
    schemaVersion: 3,
    engine: migratedEngine
  }
}

function migrateConfigDocumentV3ToV4(
  value: Record<string, unknown>
): Record<string, unknown> {
  const caption = requireRecord(value.caption, 'caption')
  const styles = requireRecord(caption.styles, 'caption.styles')
  return {
    ...value,
    schemaVersion: 4,
    caption: {
      ...caption,
      styles: {
        ...styles,
        displayMode: 'static'
      }
    }
  }
}

export function parseStyles(value: unknown): Styles {
  if (!isRecord(value)) {
    throw new InvalidConfigError('Styles must be an object')
  }
  return {
    ...value,
    displayMode: requireCaptionDisplayMode(value.displayMode),
    captionBoundaryMode: requireCaptionBoundaryMode(
      value.captionBoundaryMode
    ),
    lineNumber: requireNumber(value.lineNumber, 'lineNumber', 1, 4),
    lineBreak: requireNumber(value.lineBreak, 'lineBreak', 0, 10),
    fontFamily: requireString(value.fontFamily, 'fontFamily', 256, false),
    fontSize: requireNumber(value.fontSize, 'fontSize', 0, 72),
    fontColor: requireColor(value.fontColor, 'fontColor'),
    fontWeight: requireNumber(value.fontWeight, 'fontWeight', 1, 9),
    background: requireColor(value.background, 'background'),
    opacity: requireNumber(value.opacity, 'opacity', 0, 100),
    showPreview: requireBoolean(value.showPreview, 'showPreview'),
    transDisplay: requireBoolean(value.transDisplay, 'transDisplay'),
    transFontFamily: requireString(
      value.transFontFamily,
      'transFontFamily',
      256,
      false
    ),
    transFontSize: requireNumber(value.transFontSize, 'transFontSize', 0, 72),
    transFontColor: requireColor(value.transFontColor, 'transFontColor'),
    transFontWeight: requireNumber(
      value.transFontWeight,
      'transFontWeight',
      1,
      9
    ),
    textShadow: requireBoolean(value.textShadow, 'textShadow'),
    offsetX: requireNumber(value.offsetX, 'offsetX', -10, 10),
    offsetY: requireNumber(value.offsetY, 'offsetY', -10, 10),
    blur: requireNumber(value.blur, 'blur', 0, 12),
    textShadowColor: requireColor(
      value.textShadowColor,
      'textShadowColor'
    )
  }
}

function parseProviderConfigs(value: Record<string, unknown>): ProviderConfigs {
  const gummy = requireRecord(value.gummy, 'providers.gummy')
  const vosk = requireRecord(value.vosk, 'providers.vosk')
  const sosv = requireRecord(value.sosv, 'providers.sosv')
  const glm = requireRecord(value.glm, 'providers.glm')
  const funAsr = requireRecord(value.funAsr, 'providers.funAsr')
  const tencentSpeech = requireRecord(
    value.tencentSpeech,
    'providers.tencentSpeech'
  )
  const tencentRecognition = requireRecord(
    value.tencentRecognition,
    'providers.tencentRecognition'
  )
  const tencentRecognitionV2 = requireRecord(
    value.tencentRecognitionV2,
    'providers.tencentRecognitionV2'
  )
  const tencentHotwords = requireRecord(
    tencentSpeech.hotwords,
    'providers.tencentSpeech.hotwords'
  )
  const funAsrHotwords = requireRecord(
    funAsr.hotwords,
    'providers.funAsr.hotwords'
  )
  const workspaceId = requireWorkspaceId(funAsr.workspaceId)
  const websocketUrl = requireWebSocketUrl(
    funAsr.websocketUrl,
    'funAsr.websocketUrl'
  )
  validateFunAsrEndpoint(websocketUrl, workspaceId)
  const funAsrModel = requireFunAsrModel(funAsr.model)
  const vocabularyId = requireVocabularyId(funAsrHotwords.vocabularyId)
  const vocabularyTargetModel = requireFunAsrModel(funAsrHotwords.targetModel)
  if (vocabularyId && vocabularyTargetModel !== funAsrModel) {
    throw new InvalidConfigError('Fun-ASR hotword target model mismatch')
  }
  const tencentModel = requireString(
    tencentSpeech.model,
    'tencentSpeech.model',
    64,
    false
  )
  if (!TENCENT_SPEECH_MODELS.includes(tencentModel as never)) {
    throw new InvalidConfigError('Invalid tencentSpeech.model')
  }
  const tencentRecognitionModel = requireString(
    tencentRecognition.model,
    'tencentRecognition.model',
    64,
    false
  )
  if (!TENCENT_RECOGNITION_MODELS.includes(tencentRecognitionModel as never)) {
    throw new InvalidConfigError('Invalid tencentRecognition.model')
  }
  const tencentRecognitionV2Model = requireString(
    tencentRecognitionV2.model,
    'tencentRecognitionV2.model',
    64,
    false
  )
  if (!TENCENT_RECOGNITION_V2_MODELS.includes(tencentRecognitionV2Model as never)) {
    throw new InvalidConfigError('Invalid tencentRecognitionV2.model')
  }
  const tencentAppId = requireString(
    tencentSpeech.appId,
    'tencentSpeech.appId',
    64
  )
  if (tencentAppId && !/^\d+$/.test(tencentAppId)) {
    throw new InvalidConfigError('Tencent Speech AppID must contain digits only')
  }
  const tencentSecretId = requireString(
    tencentSpeech.secretId,
    'tencentSpeech.secretId',
    256
  )
  const tencentSecretKey = requireString(
    tencentSpeech.secretKey,
    'tencentSpeech.secretKey',
    256
  )
  const tencentHotwordEntries = requireContextTerms(tencentHotwords.entries)
  if (tencentHotwordEntries.length > 0) {
    throw new InvalidConfigError('Tencent Speech hotwords are reserved and must be empty')
  }
  return {
    ...value,
    gummy: {
      ...gummy,
      apiKey: requireString(gummy.apiKey, 'gummy.apiKey', 8192)
    },
    vosk: {
      ...vosk,
      modelPath: requireString(vosk.modelPath, 'vosk.modelPath')
    },
    sosv: {
      ...sosv,
      modelPath: requireString(sosv.modelPath, 'sosv.modelPath')
    },
    glm: {
      ...glm,
      url: requireUrl(glm.url, 'glm.url', false),
      model: requireString(glm.model, 'glm.model', 256, false),
      apiKey: requireString(glm.apiKey, 'glm.apiKey', 8192)
    },
    funAsr: {
      ...funAsr,
      model: funAsrModel,
      websocketUrl,
      workspaceId,
      apiKey: requireString(funAsr.apiKey, 'funAsr.apiKey', 8192),
      semanticPunctuationEnabled: requireBoolean(
        funAsr.semanticPunctuationEnabled,
        'funAsr.semanticPunctuationEnabled'
      ),
      maxSentenceSilenceMs: requireNumber(
        funAsr.maxSentenceSilenceMs,
        'funAsr.maxSentenceSilenceMs',
        200,
        6000
      ),
      heartbeatEnabled: requireBoolean(
        funAsr.heartbeatEnabled,
        'funAsr.heartbeatEnabled'
      ),
      hotwords: {
        ...funAsrHotwords,
        vocabularyId,
        targetModel: vocabularyTargetModel,
        contextTerms: requireContextTerms(funAsrHotwords.contextTerms)
      }
    },
    tencentSpeech: {
      ...tencentSpeech,
      appId: tencentAppId,
      secretId: tencentSecretId,
      secretKey: tencentSecretKey,
      model: tencentModel as (typeof TENCENT_SPEECH_MODELS)[number],
      vadSilenceMs: requireNumber(
        tencentSpeech.vadSilenceMs,
        'tencentSpeech.vadSilenceMs',
        500,
        2000
      ),
      maxSpeakTimeMs: requireNumber(
        tencentSpeech.maxSpeakTimeMs,
        'tencentSpeech.maxSpeakTimeMs',
        5000,
        90000
      ),
      hotwords: {
        ...tencentHotwords,
        entries: tencentHotwordEntries
      }
    },
    tencentRecognition: {
      ...tencentRecognition,
      model: tencentRecognitionModel as (typeof TENCENT_RECOGNITION_MODELS)[number],
      vadSilenceMs: requireNumber(
        tencentRecognition.vadSilenceMs,
        'tencentRecognition.vadSilenceMs',
        240,
        2000
      ),
      maxSpeakTimeMs: requireNumber(
        tencentRecognition.maxSpeakTimeMs,
        'tencentRecognition.maxSpeakTimeMs',
        5000,
        90000
      )
    },
    tencentRecognitionV2: {
      ...tencentRecognitionV2,
      model: tencentRecognitionV2Model as (typeof TENCENT_RECOGNITION_V2_MODELS)[number],
      vadSilenceMs: requireNumber(
        tencentRecognitionV2.vadSilenceMs,
        'tencentRecognitionV2.vadSilenceMs',
        240,
        2000
      ),
      sentenceStrategy: requireNumber(
        tencentRecognitionV2.sentenceStrategy,
        'tencentRecognitionV2.sentenceStrategy',
        0,
        1
      ) as 0 | 1
    }
  }
}

export function parseCaptionConfig(
  value: unknown
): ConfigDocumentV10['caption'] {
  if (!isRecord(value)) {
    throw new InvalidConfigError('Caption config must be an object')
  }
  return {
    ...value,
    styles: parseStyles(value.styles)
  }
}

function requireCaptionDisplayMode(value: unknown): CaptionDisplayMode {
  if (value !== 'static' && value !== 'rolling') {
    throw new InvalidConfigError('Invalid displayMode')
  }
  return value
}

function requireCaptionBoundaryMode(value: unknown): CaptionBoundaryMode {
  if (value !== 'sentence' && value !== 'continuous') {
    throw new InvalidConfigError('Invalid captionBoundaryMode')
  }
  return value
}

function requireRecord(
  value: unknown,
  field: string
): Record<string, unknown> {
  if (!isRecord(value)) throw new InvalidConfigError(`${field} must be an object`)
  return value
}
