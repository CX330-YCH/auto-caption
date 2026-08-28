import type { KnownTranslationProviderName } from '../../../shared/config/schema.ts'
import type {
  EngineFieldDescriptor,
  EngineLanguage
} from '../engines/types.ts'

export interface TranslationCapabilities {
  availability: 'available' | 'unavailable'
  network: 'required' | 'optional'
  credentials: 'none' | 'optional' | 'required'
  customEndpoint: boolean
}

export interface TranslationDefinition {
  id: KnownTranslationProviderName
  labelKey: string
  unavailableReasonKey?: string
  capabilities: TranslationCapabilities
  languages: readonly EngineLanguage[]
  providerFields: readonly EngineFieldDescriptor[]
}
