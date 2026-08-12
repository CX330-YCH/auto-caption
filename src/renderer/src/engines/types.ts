import type {
  EngineConfig,
  KnownProviderName
} from '../../../shared/config/schema.ts'

export type EngineConfigPath =
  | 'provider'
  | 'common.sourceLanguage'
  | 'common.targetLanguage'
  | 'common.audioSource'
  | 'common.translation.enabled'
  | 'common.translation.provider'
  | 'common.translation.model'
  | 'common.translation.url'
  | 'common.translation.apiKey'
  | 'common.recording.enabled'
  | 'common.recording.path'
  | 'common.startTimeoutSeconds'
  | 'providers.gummy.apiKey'
  | 'providers.vosk.modelPath'
  | 'providers.sosv.modelPath'
  | 'providers.glm.url'
  | 'providers.glm.model'
  | 'providers.glm.apiKey'
  | 'providers.funAsr.model'
  | 'providers.funAsr.websocketUrl'
  | 'providers.funAsr.workspaceId'
  | 'providers.funAsr.apiKey'
  | 'providers.funAsr.semanticPunctuationEnabled'
  | 'providers.funAsr.maxSentenceSilenceMs'
  | 'providers.funAsr.heartbeatEnabled'
  | 'providers.funAsr.hotwords.vocabularyId'
  | 'providers.funAsr.hotwords.targetModel'
  | 'providers.funAsr.hotwords.contextTerms'
  | 'custom.enabled'
  | 'custom.executable'
  | 'custom.command'

export type EngineFieldControl = 'select' | 'text' | 'password' | 'number' | 'switch' | 'directory'

export type EngineFieldSection = 'primary' | 'advanced' | 'custom'
export type EngineValidationPhase = 'apply' | 'start'

export interface EngineFieldOption {
  value: string | number
  labelKey: string
}

export interface EngineFieldCondition {
  path: EngineConfigPath
  equals: string | number | boolean
}

export interface EngineFieldValidation {
  phase: EngineValidationPhase
  titleKey: string
  descriptionKey: string
  when?: readonly EngineFieldCondition[]
}

export interface EngineFieldDescriptor {
  id: string
  path: EngineConfigPath
  control: EngineFieldControl
  section: EngineFieldSection
  labelKey: string
  helpKey?: string
  helpLink?: string
  helpLinkLabelKey?: string
  options?: readonly EngineFieldOption[]
  disabled?: boolean
  placeholder?: string
  min?: number
  max?: number
  step?: number
  addonAfterKey?: string
  visibleWhen?: readonly EngineFieldCondition[]
  required?: EngineFieldValidation
  defaultWhenEmpty?: string
}

export type LanguageRole = 'source' | 'target'

export interface EngineLanguage {
  value: string
  labelKey: string
  roles: readonly LanguageRole[]
}

export interface EngineCapabilities {
  sourceLanguage: 'selectable' | 'model-defined'
  translation: 'integrated' | 'external'
  recording: boolean
  hotwords: 'unsupported' | 'manager'
}

export interface EngineDefinition {
  id: KnownProviderName
  labelKey: string
  capabilities: EngineCapabilities
  languages: readonly EngineLanguage[]
  providerFields: readonly EngineFieldDescriptor[]
  defaultSourceLanguage: string
  validate?: (
    config: EngineConfig,
    phase: EngineValidationPhase
  ) => EngineValidationIssue | null
}

export interface EngineValidationIssue {
  fieldId: string
  titleKey: string
  descriptionKey: string
}
