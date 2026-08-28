import type {
  EngineConfig,
  KnownTranslationProviderName
} from '../../../shared/config/schema.ts'
import type { UILanguage } from '../../../shared/types.ts'
import {
  conditionsMatch,
  getEngineConfigValue,
  isEmptyEngineFieldValue,
  setEngineConfigValue
} from '../engines/form.ts'
import type {
  EngineDefinition,
  EngineFieldDescriptor,
  EngineFieldOption,
  EngineLanguage,
  EngineValidationIssue,
  EngineValidationPhase
} from '../engines/types.ts'
import type { TranslationDefinition } from './types.ts'

const language = (value: string): EngineLanguage => ({
  value,
  labelKey: `engine.options.languages.${value}`,
  roles: ['target']
})

const commonTargetLanguages = [
  language('en'),
  language('zh'),
  language('ja'),
  language('ko'),
  language('de'),
  language('fr'),
  language('ru'),
  language('es'),
  language('it')
]

export const translationDefinitions: readonly TranslationDefinition[] = [
  {
    id: 'azure',
    labelKey: 'engine.options.translation.azure',
    unavailableReasonKey: 'engine.translation.azureUnavailable',
    capabilities: {
      availability: 'unavailable',
      network: 'required',
      credentials: 'required',
      customEndpoint: true
    },
    languages: commonTargetLanguages,
    providerFields: [
      {
        id: 'translation-azure-endpoint',
        path: 'translation.providers.azure.endpoint',
        control: 'text',
        section: 'translation',
        labelKey: 'engine.fields.azureTranslationEndpoint'
      },
      {
        id: 'translation-azure-region',
        path: 'translation.providers.azure.region',
        control: 'text',
        section: 'translation',
        labelKey: 'engine.fields.azureTranslationRegion'
      },
      {
        id: 'translation-azure-api-key',
        path: 'translation.providers.azure.apiKey',
        control: 'password',
        section: 'translation',
        labelKey: 'engine.fields.azureTranslationApiKey'
      }
    ]
  },
  {
    id: 'google',
    labelKey: 'engine.options.translation.google',
    capabilities: {
      availability: 'available',
      network: 'required',
      credentials: 'none',
      customEndpoint: false
    },
    languages: commonTargetLanguages,
    providerFields: []
  },
  {
    id: 'ollama',
    labelKey: 'engine.options.translation.ollama',
    capabilities: {
      availability: 'available',
      network: 'optional',
      credentials: 'optional',
      customEndpoint: true
    },
    languages: commonTargetLanguages,
    providerFields: [
      {
        id: 'translation-ollama-model',
        path: 'translation.providers.ollama.model',
        control: 'text',
        section: 'translation',
        labelKey: 'engine.modelName',
        helpKey: 'engine.modelNameNote',
        required: {
          phase: 'apply',
          titleKey: 'noti.ollamaNameNull',
          descriptionKey: 'noti.ollamaNameNullNote'
        }
      },
      {
        id: 'translation-ollama-url',
        path: 'translation.providers.ollama.url',
        control: 'text',
        section: 'translation',
        labelKey: 'engine.fields.baseUrl',
        helpKey: 'engine.baseURL',
        placeholder: 'http://localhost:11434'
      },
      {
        id: 'translation-ollama-api-key',
        path: 'translation.providers.ollama.apiKey',
        control: 'password',
        section: 'translation',
        labelKey: 'engine.fields.translationApiKey',
        helpKey: 'engine.apiKey'
      }
    ]
  }
]

const definitionsById = new Map<
  KnownTranslationProviderName,
  TranslationDefinition
>(translationDefinitions.map((definition) => [definition.id, definition]))

export function getTranslationDefinition(
  provider: KnownTranslationProviderName
): TranslationDefinition {
  const definition = definitionsById.get(provider)
  if (!definition) throw new Error(`Unknown translation engine: ${provider}`)
  return definition
}

export function getTranslationOptions(): readonly EngineFieldOption[] {
  return translationDefinitions.map((definition) => ({
    value: definition.id,
    labelKey: definition.labelKey,
    disabled: definition.capabilities.availability === 'unavailable',
    disabledReasonKey: definition.unavailableReasonKey
  }))
}

function targetOptions(
  config: EngineConfig,
  recognition: EngineDefinition
): readonly EngineFieldOption[] {
  const languages = recognition.capabilities.translation === 'integrated'
    ? recognition.languages.filter((item) => item.roles.includes('target'))
    : getTranslationDefinition(config.translation.activeProviderId).languages
  return languages.map(({ value, labelKey }) => ({ value, labelKey }))
}

export function getTranslationFields(
  config: EngineConfig,
  recognition: EngineDefinition
): readonly EngineFieldDescriptor[] {
  const fields: EngineFieldDescriptor[] = [
    {
      id: 'translation-enabled',
      path: 'translation.enabled',
      control: 'switch',
      section: 'primary',
      labelKey: 'engine.enableTranslation'
    },
    {
      id: 'translation-target-language',
      path: 'translation.common.targetLanguage',
      control: 'select',
      section: 'primary',
      labelKey: 'engine.transLang',
      options: targetOptions(config, recognition),
      visibleWhen: [{ path: 'translation.enabled', equals: true }]
    }
  ]
  if (recognition.capabilities.translation === 'integrated') return fields

  const active = getTranslationDefinition(config.translation.activeProviderId)
  fields.push({
    id: 'translation-provider',
    path: 'translation.activeProviderId',
    control: 'select',
    section: 'translation',
    labelKey: 'engine.transModel',
    options: getTranslationOptions(),
    visibleWhen: [{ path: 'translation.enabled', equals: true }]
  })
  fields.push(...active.providerFields.map((field): EngineFieldDescriptor => ({
    ...field,
    visibleWhen: [{ path: 'translation.enabled', equals: true }]
  })))
  return fields
}

export function normalizeTranslationConfig(
  config: EngineConfig,
  recognition: EngineDefinition
): void {
  for (const field of getTranslationFields(config, recognition)) {
    if (
      field.defaultWhenEmpty &&
      isEmptyEngineFieldValue(getEngineConfigValue(config, field.path))
    ) {
      setEngineConfigValue(config, field.path, field.defaultWhenEmpty)
    }
  }
}

export function validateTranslationConfig(
  config: EngineConfig,
  recognition: EngineDefinition,
  phase: EngineValidationPhase
): EngineValidationIssue | null {
  if (!config.translation.enabled) return null
  if (recognition.capabilities.translation === 'external') {
    const active = getTranslationDefinition(config.translation.activeProviderId)
    if (active.capabilities.availability === 'unavailable') {
      return {
        fieldId: 'translation-provider',
        titleKey: 'noti.translationUnavailable',
        descriptionKey: active.unavailableReasonKey ?? 'noti.translationUnavailableNote'
      }
    }
  }
  for (const field of getTranslationFields(config, recognition)) {
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
  return null
}

export function applyTranslationLanguageDefault(
  config: EngineConfig,
  recognition: EngineDefinition,
  uiLanguage: UILanguage
): void {
  const options = targetOptions(config, recognition)
  const preferred = uiLanguage === 'zh' ? ['zh', 'zh-cn'] : [uiLanguage]
  const target = preferred
    .map((value) => options.find((option) => option.value === value))
    .find(Boolean) ?? options[0]
  if (target) config.translation.common.targetLanguage = String(target.value)
}
