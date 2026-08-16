import type { CaptionDisplayMode, Styles } from '../types'
import {
  CONFIG_SCHEMA_VERSION,
  InvalidConfigError,
  UnsupportedConfigVersionError,
  isKnownProviderName,
  type ApplicationConfig,
  type ConfigDocumentV4,
  type EngineConfig,
  type ProviderConfigs
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

export function parseConfigDocumentV4(value: unknown): ConfigDocumentV4 {
  if (!isRecord(value)) {
    throw new InvalidConfigError('Config root must be an object')
  }
  if (value.schemaVersion === 2) {
    return parseConfigDocumentV4(migrateConfigDocumentV2ToV3(value))
  }
  if (value.schemaVersion === 3) {
    return parseConfigDocumentV4(migrateConfigDocumentV3ToV4(value))
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

export function parseApplicationConfig(value: unknown): ApplicationConfig {
  if (!isRecord(value)) {
    throw new InvalidConfigError('Application config must be an object')
  }
  if (!isRecord(value.layout)) {
    throw new InvalidConfigError('Application layout must be an object')
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
  if (!isRecord(value.common.translation)) {
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
  return {
    ...value,
    activeEngineId,
    common: {
      ...value.common,
      sourceLanguage: requireString(
        value.common.sourceLanguage,
        'sourceLanguage',
        32,
        false
      ),
      targetLanguage: requireString(
        value.common.targetLanguage,
        'targetLanguage',
        32,
        false
      ),
      audioSource: audioSource as 0 | 1,
      translation: {
        ...value.common.translation,
        enabled: requireBoolean(
          value.common.translation.enabled,
          'translation.enabled'
        ),
        provider: requireString(
          value.common.translation.provider,
          'translation.provider',
          64,
          false
        ),
        model: requireString(
          value.common.translation.model,
          'translation.model',
          256
        ),
        url: requireUrl(
          value.common.translation.url,
          'translation.url'
        ),
        apiKey: requireString(
          value.common.translation.apiKey,
          'translation.apiKey',
          8192
        )
      },
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
    providers: parseProviderConfigs(value.providers),
    customEngines
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
    schemaVersion: CONFIG_SCHEMA_VERSION,
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
    }
  }
}

export function parseCaptionConfig(
  value: unknown
): ConfigDocumentV4['caption'] {
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

function requireRecord(
  value: unknown,
  field: string
): Record<string, unknown> {
  if (!isRecord(value)) throw new InvalidConfigError(`${field} must be an object`)
  return value
}
