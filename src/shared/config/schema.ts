import type { Styles, UILanguage, UITheme } from '../types'

export const CONFIG_SCHEMA_VERSION = 7 as const

export type KnownProviderName = 'gummy' | 'vosk' | 'sosv' | 'glm' | 'fun_asr' | 'apple_speech'
export type AudioSourceType = 0 | 1
export type KnownTranslationProviderName = 'azure' | 'google' | 'ollama'

export function isKnownProviderName(value: unknown): value is KnownProviderName {
  return value === 'gummy' || value === 'vosk' || value === 'sosv' ||
    value === 'glm' || value === 'fun_asr' || value === 'apple_speech'
}

export function isKnownTranslationProviderName(
  value: unknown
): value is KnownTranslationProviderName {
  return value === 'azure' || value === 'google' || value === 'ollama'
}

export interface TranslationCommonConfig {
  [key: string]: unknown
  targetLanguage: string
}

export interface AzureTranslationProviderConfig {
  [key: string]: unknown
  endpoint: string
  region: string
  apiKey: string
}

export interface GoogleTranslationProviderConfig {
  [key: string]: unknown
}

export interface OllamaTranslationProviderConfig {
  [key: string]: unknown
  model: string
  url: string
  apiKey: string
}

export interface TranslationProviderConfigs {
  [key: string]: unknown
  azure: AzureTranslationProviderConfig
  google: GoogleTranslationProviderConfig
  ollama: OllamaTranslationProviderConfig
}

export interface TranslationConfig {
  [key: string]: unknown
  enabled: boolean
  activeProviderId: KnownTranslationProviderName
  common: TranslationCommonConfig
  providers: TranslationProviderConfigs
}

export interface RecordingConfig {
  [key: string]: unknown
  enabled: boolean
  path: string
}

export interface EngineCommonConfig {
  [key: string]: unknown
  sourceLanguage: string
  audioSource: AudioSourceType
  recording: RecordingConfig
  startTimeoutSeconds: number
}

export interface GummyProviderConfig {
  [key: string]: unknown
  apiKey: string
}

export interface VoskProviderConfig {
  [key: string]: unknown
  modelPath: string
}

export interface SosvProviderConfig {
  [key: string]: unknown
  modelPath: string
}

export interface GlmProviderConfig {
  [key: string]: unknown
  url: string
  model: string
  apiKey: string
}

export interface FunAsrProviderConfig {
  [key: string]: unknown
  model: string
  websocketUrl: string
  workspaceId: string
  apiKey: string
  semanticPunctuationEnabled: boolean
  maxSentenceSilenceMs: number
  heartbeatEnabled: boolean
  hotwords: FunAsrHotwordConfig
}

export interface FunAsrHotwordConfig {
  [key: string]: unknown
  vocabularyId: string
  targetModel: string
  contextTerms: string[]
}

export interface ProviderConfigs {
  [key: string]: unknown
  gummy: GummyProviderConfig
  vosk: VoskProviderConfig
  sosv: SosvProviderConfig
  glm: GlmProviderConfig
  funAsr: FunAsrProviderConfig
}

export interface CustomEngineConfig {
  [key: string]: unknown
  id: string
  name: string
  executable: string
  command: string
}

export interface EngineConfig {
  [key: string]: unknown
  activeEngineId: string
  common: EngineCommonConfig
  providers: ProviderConfigs
  translation: TranslationConfig
  customEngines: CustomEngineConfig[]
}

export function getActiveBuiltinProvider(config: EngineConfig): KnownProviderName | null {
  return isKnownProviderName(config.activeEngineId) ? config.activeEngineId : null
}

export function getActiveCustomEngine(config: EngineConfig): CustomEngineConfig | null {
  return config.customEngines.find((engine) => engine.id === config.activeEngineId) ?? null
}

export interface ApplicationLayoutConfig {
  [key: string]: unknown
  leftBarWidth: number
  captionWindowWidth: number
}

export interface DiagnosticsConfig {
  [key: string]: unknown
  debugMode: boolean
}

export interface ApplicationConfig {
  [key: string]: unknown
  language: UILanguage
  theme: UITheme
  accentColor: string
  layout: ApplicationLayoutConfig
  diagnostics: DiagnosticsConfig
}

export interface CaptionConfig {
  [key: string]: unknown
  styles: Styles
}

export interface ConfigDocumentV7 {
  [key: string]: unknown
  schemaVersion: typeof CONFIG_SCHEMA_VERSION
  application: ApplicationConfig
  engine: EngineConfig
  caption: CaptionConfig
}

export class UnsupportedConfigVersionError extends Error {
  public constructor(version: number) {
    super(`Unsupported config schema version: ${version}`)
    this.name = 'UnsupportedConfigVersionError'
  }
}

export class InvalidConfigError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = 'InvalidConfigError'
  }
}

export function createDefaultStyles(): Styles {
  return {
    displayMode: 'static',
    captionBoundaryMode: 'sentence',
    lineNumber: 1,
    lineBreak: 1,
    fontFamily: 'sans-serif',
    fontSize: 24,
    fontColor: '#000000',
    fontWeight: 4,
    background: '#dbe2ef',
    opacity: 80,
    showPreview: true,
    transDisplay: true,
    transFontFamily: 'sans-serif',
    transFontSize: 24,
    transFontColor: '#000000',
    transFontWeight: 4,
    textShadow: false,
    offsetX: 2,
    offsetY: 2,
    blur: 0,
    textShadowColor: '#ffffff'
  }
}

export function createDefaultConfig(recordingPath: string): ConfigDocumentV7 {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    application: {
      language: 'zh',
      theme: 'system',
      accentColor: '#1677ff',
      layout: {
        leftBarWidth: 8,
        captionWindowWidth: 900
      },
      diagnostics: {
        debugMode: false
      }
    },
    engine: {
      activeEngineId: 'gummy',
      common: {
        sourceLanguage: 'en',
        audioSource: 0,
        recording: {
          enabled: false,
          path: recordingPath
        },
        startTimeoutSeconds: 30
      },
      providers: {
        gummy: { apiKey: '' },
        vosk: { modelPath: '' },
        sosv: { modelPath: '' },
        glm: {
          url: 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions',
          model: 'glm-asr-2512',
          apiKey: ''
        },
        funAsr: {
          model: 'fun-asr-realtime',
          websocketUrl: '',
          workspaceId: '',
          apiKey: '',
          semanticPunctuationEnabled: false,
          maxSentenceSilenceMs: 1300,
          heartbeatEnabled: true,
          hotwords: {
            vocabularyId: '',
            targetModel: 'fun-asr-realtime',
            contextTerms: []
          }
        }
      },
      translation: {
        enabled: true,
        activeProviderId: 'ollama',
        common: {
          targetLanguage: 'zh'
        },
        providers: {
          azure: {
            endpoint: 'https://api.cognitive.microsofttranslator.com',
            region: '',
            apiKey: ''
          },
          google: {},
          ollama: {
            model: 'qwen2.5:0.5b',
            url: 'http://localhost:11434',
            apiKey: ''
          }
        }
      },
      customEngines: []
    },
    caption: {
      styles: createDefaultStyles()
    }
  }
}
