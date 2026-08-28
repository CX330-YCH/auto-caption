import {
  getActiveBuiltinProvider,
  getActiveCustomEngine,
  type EngineConfig,
  type KnownProviderName
} from '../../../shared/config/schema.ts'
import type { UILanguage } from '../../../shared/types.ts'
import { normalizeAppleSpeechLocale } from '../../../shared/appleSpeech.ts'
import {
  conditionsMatch,
  getEngineConfigValue,
  isEmptyEngineFieldValue,
  setEngineConfigValue
} from './form.ts'
import { glmEngine } from './providers/glm.ts'
import { funAsrEngine } from './providers/fun_asr.ts'
import { gummyEngine } from './providers/gummy.ts'
import { sosvEngine } from './providers/sosv.ts'
import { voskEngine } from './providers/vosk.ts'
import { appleSpeechEngine } from './providers/apple_speech.ts'
import {
  applyTranslationLanguageDefault,
  getTranslationFields,
  normalizeTranslationConfig,
  validateTranslationConfig
} from '../translations/catalog.ts'
import type {
  EngineDefinition,
  EngineFieldDescriptor,
  EngineFieldOption,
  EngineValidationIssue,
  EngineValidationPhase
} from './types.ts'

export const engineDefinitions = [
  gummyEngine,
  voskEngine,
  sosvEngine,
  glmEngine,
  funAsrEngine,
  appleSpeechEngine
] as const satisfies readonly EngineDefinition[]

const engineDefinitionsById = new Map<KnownProviderName, EngineDefinition>(
  engineDefinitions.map((definition) => [definition.id, definition])
)

const audioOptions: readonly EngineFieldOption[] = [
  { value: 0, labelKey: 'engine.systemOutput' },
  { value: 1, labelKey: 'engine.systemInput' }
]

const commonAdvancedFields: readonly EngineFieldDescriptor[] = [
  {
    id: 'recording-path',
    path: 'common.recording.path',
    control: 'directory',
    section: 'advanced',
    labelKey: 'engine.recordingPath',
    helpKey: 'engine.recordingPathInfo'
  },
  {
    id: 'start-timeout',
    path: 'common.startTimeoutSeconds',
    control: 'number',
    section: 'advanced',
    labelKey: 'engine.startTimeout',
    helpKey: 'engine.startTimeoutInfo',
    min: 10,
    max: 120,
    step: 5,
    addonAfterKey: 'engine.seconds'
  }
]

export function getEngineDefinition(provider: KnownProviderName): EngineDefinition {
  const definition = engineDefinitionsById.get(provider)
  if (!definition) throw new Error(`Unknown caption engine: ${provider}`)
  return definition
}

export function getEngineOptions(): readonly EngineFieldOption[] {
  return engineDefinitions.map(({ id, labelKey }) => ({ value: id, labelKey }))
}

function languageOptions(
  definition: EngineDefinition,
  role: 'source'
): readonly EngineFieldOption[] {
  return definition.languages
    .filter((language) => language.roles.includes(role))
    .map(({ value, labelKey }) => ({ value, labelKey }))
}

function commonPrimaryFields(definition: EngineDefinition): EngineFieldDescriptor[] {
  const fields: EngineFieldDescriptor[] = [
    {
      id: 'source-language',
      path: 'common.sourceLanguage',
      control: 'select',
      section: 'primary',
      labelKey: 'engine.sourceLang',
      options: languageOptions(definition, 'source'),
      disabled: definition.capabilities.sourceLanguage === 'model-defined'
    },
  ]

  fields.push(
    ...definition.providerFields.filter((field) => field.section === 'primary'),
    {
      id: 'audio-source',
      path: 'common.audioSource',
      control: 'select',
      section: 'primary',
      labelKey: 'engine.audioType',
      options: audioOptions
    }
  )

  if (definition.capabilities.recording) {
    fields.push({
      id: 'recording-enabled',
      path: 'common.recording.enabled',
      control: 'switch',
      section: 'primary',
      labelKey: 'engine.enableRecording'
    })
  }

  return fields
}

export function getEngineFields(provider: KnownProviderName): readonly EngineFieldDescriptor[] {
  const definition = getEngineDefinition(provider)
  return [
    ...commonPrimaryFields(definition),
    ...definition.providerFields.filter((field) => field.section === 'advanced'),
    ...(definition.capabilities.recording ? commonAdvancedFields : [])
  ]
}

export function normalizeEngineConfig(config: EngineConfig): void {
  const provider = getActiveBuiltinProvider(config)
  if (!provider) return
  if (provider === 'apple_speech') {
    config.common.sourceLanguage = normalizeAppleSpeechLocale(config.common.sourceLanguage)
  }
  for (const field of getEngineFields(provider)) {
    if (
      field.defaultWhenEmpty &&
      isEmptyEngineFieldValue(getEngineConfigValue(config, field.path))
    ) {
      setEngineConfigValue(config, field.path, field.defaultWhenEmpty)
    }
  }
  normalizeTranslationConfig(config, getEngineDefinition(provider))
}

export function validateEngineConfig(
  config: EngineConfig,
  phase: EngineValidationPhase
): EngineValidationIssue | null {
  const customEngine = getActiveCustomEngine(config)
  if (customEngine) {
    if (phase === 'start' && !customEngine.executable.trim()) {
      return {
        fieldId: 'custom-executable',
        titleKey: 'noti.customExecutableMissing',
        descriptionKey: 'noti.customExecutableMissingNote'
      }
    }
    return null
  }
  const provider = getActiveBuiltinProvider(config)
  if (!provider) {
    return {
      fieldId: 'active-engine',
      titleKey: 'noti.customEngineMissing',
      descriptionKey: 'noti.customEngineMissingNote'
    }
  }
  for (const field of getEngineFields(provider)) {
    const validation = field.required
    if (
      validation?.phase === phase &&
      conditionsMatch(config, validation.when) &&
      isEmptyEngineFieldValue(getEngineConfigValue(config, field.path))
    ) {
      return {
        fieldId: field.id,
        titleKey: validation.titleKey,
        descriptionKey: validation.descriptionKey
      }
    }
  }
  const definition = getEngineDefinition(provider)
  return definition.validate?.(config, phase) ??
    validateTranslationConfig(config, definition, phase)
}

export function applyEngineLanguageDefaults(
  config: EngineConfig,
  provider: KnownProviderName,
  uiLanguage: UILanguage
): void {
  const definition = getEngineDefinition(provider)
  config.common.sourceLanguage = definition.defaultSourceLanguage
  applyTranslationLanguageDefault(config, definition, uiLanguage)
}

export { getTranslationFields }
