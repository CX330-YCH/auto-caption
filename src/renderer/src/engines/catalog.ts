import type { EngineConfig, KnownProviderName } from '../../../shared/config/schema.ts'
import type { UILanguage } from '../../../shared/types.ts'
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
  funAsrEngine
] as const satisfies readonly EngineDefinition[]

const engineDefinitionsById = new Map<KnownProviderName, EngineDefinition>(
  engineDefinitions.map((definition) => [definition.id, definition])
)

const translationOptions: readonly EngineFieldOption[] = [
  { value: 'ollama', labelKey: 'engine.options.translation.ollama' },
  { value: 'google', labelKey: 'engine.options.translation.google' }
]

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

const customFields: readonly EngineFieldDescriptor[] = [
  {
    id: 'custom-executable',
    path: 'custom.executable',
    control: 'text',
    section: 'custom',
    labelKey: 'engine.custom.app'
  },
  {
    id: 'custom-command',
    path: 'custom.command',
    control: 'text',
    section: 'custom',
    labelKey: 'engine.custom.command'
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
  role: 'source' | 'target'
): readonly EngineFieldOption[] {
  return definition.languages
    .filter((language) => language.roles.includes(role))
    .map(({ value, labelKey }) => ({ value, labelKey }))
}

function commonPrimaryFields(definition: EngineDefinition): EngineFieldDescriptor[] {
  const fields: EngineFieldDescriptor[] = [
    {
      id: 'provider',
      path: 'provider',
      control: 'select',
      section: 'primary',
      labelKey: 'engine.captionEngine',
      options: getEngineOptions()
    },
    {
      id: 'source-language',
      path: 'common.sourceLanguage',
      control: 'select',
      section: 'primary',
      labelKey: 'engine.sourceLang',
      options: languageOptions(definition, 'source'),
      disabled: definition.capabilities.sourceLanguage === 'model-defined'
    },
    {
      id: 'target-language',
      path: 'common.targetLanguage',
      control: 'select',
      section: 'primary',
      labelKey: 'engine.transLang',
      options: languageOptions(definition, 'target')
    }
  ]

  if (definition.capabilities.translation === 'external') {
    fields.push(
      {
        id: 'translation-provider',
        path: 'common.translation.provider',
        control: 'select',
        section: 'primary',
        labelKey: 'engine.transModel',
        options: translationOptions
      },
      {
        id: 'translation-model',
        path: 'common.translation.model',
        control: 'text',
        section: 'primary',
        labelKey: 'engine.modelName',
        helpKey: 'engine.modelNameNote',
        visibleWhen: [{ path: 'common.translation.provider', equals: 'ollama' }],
        required: {
          phase: 'apply',
          titleKey: 'noti.ollamaNameNull',
          descriptionKey: 'noti.ollamaNameNullNote',
          when: [
            { path: 'common.translation.enabled', equals: true },
            { path: 'common.translation.provider', equals: 'ollama' }
          ]
        }
      },
      {
        id: 'translation-url',
        path: 'common.translation.url',
        control: 'text',
        section: 'primary',
        labelKey: 'engine.fields.baseUrl',
        helpKey: 'engine.baseURL',
        placeholder: 'http://localhost:11434',
        visibleWhen: [{ path: 'common.translation.provider', equals: 'ollama' }]
      },
      {
        id: 'translation-api-key',
        path: 'common.translation.apiKey',
        control: 'password',
        section: 'primary',
        labelKey: 'engine.fields.translationApiKey',
        helpKey: 'engine.apiKey',
        visibleWhen: [{ path: 'common.translation.provider', equals: 'ollama' }]
      }
    )
  }

  fields.push(
    ...definition.providerFields.filter((field) => field.section === 'primary'),
    {
      id: 'audio-source',
      path: 'common.audioSource',
      control: 'select',
      section: 'primary',
      labelKey: 'engine.audioType',
      options: audioOptions
    },
    {
      id: 'translation-enabled',
      path: 'common.translation.enabled',
      control: 'switch',
      section: 'primary',
      labelKey: 'engine.enableTranslation'
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

  fields.push({
    id: 'custom-enabled',
    path: 'custom.enabled',
    control: 'switch',
    section: 'primary',
    labelKey: 'engine.customEngine'
  })
  return fields
}

export function getEngineFields(provider: KnownProviderName): readonly EngineFieldDescriptor[] {
  const definition = getEngineDefinition(provider)
  return [
    ...commonPrimaryFields(definition),
    ...definition.providerFields.filter((field) => field.section === 'advanced'),
    ...(definition.capabilities.recording ? commonAdvancedFields : []),
    ...customFields
  ]
}

export function normalizeEngineConfig(config: EngineConfig): void {
  for (const field of getEngineFields(config.provider)) {
    if (
      field.defaultWhenEmpty &&
      isEmptyEngineFieldValue(getEngineConfigValue(config, field.path))
    ) {
      setEngineConfigValue(config, field.path, field.defaultWhenEmpty)
    }
  }
}

export function validateEngineConfig(
  config: EngineConfig,
  phase: EngineValidationPhase
): EngineValidationIssue | null {
  for (const field of getEngineFields(config.provider)) {
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
  return getEngineDefinition(config.provider).validate?.(config, phase) ?? null
}

export function applyEngineLanguageDefaults(
  config: EngineConfig,
  provider: KnownProviderName,
  uiLanguage: UILanguage
): void {
  const definition = getEngineDefinition(provider)
  const targetLanguages = definition.languages.filter((language) => {
    return language.roles.includes('target')
  })
  const preferredTargets = uiLanguage === 'zh' ? ['zh', 'zh-cn'] : [uiLanguage]
  const target =
    preferredTargets
      .map((value) => targetLanguages.find((language) => language.value === value))
      .find(Boolean) ?? targetLanguages[0]

  config.common.sourceLanguage = definition.defaultSourceLanguage
  if (target) config.common.targetLanguage = target.value
}
