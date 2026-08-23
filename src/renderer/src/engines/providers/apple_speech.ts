import type { EngineDefinition } from '../types.ts'

export const appleSpeechEngine: EngineDefinition = {
  id: 'apple_speech',
  labelKey: 'engine.options.providers.appleSpeech',
  capabilities: {
    sourceLanguage: 'selectable',
    translation: 'external',
    recording: true,
    hotwords: 'unsupported'
  },
  languages: [
    { value: 'zh-CN', labelKey: 'engine.options.languages.zhCN', roles: ['source'] },
    { value: 'en-US', labelKey: 'engine.options.languages.enUS', roles: ['source'] },
    { value: 'ja-JP', labelKey: 'engine.options.languages.jaJP', roles: ['source'] },
    { value: 'zh', labelKey: 'engine.options.languages.zh', roles: ['target'] },
    { value: 'en', labelKey: 'engine.options.languages.en', roles: ['target'] },
    { value: 'ja', labelKey: 'engine.options.languages.ja', roles: ['target'] }
  ],
  providerFields: [],
  defaultSourceLanguage: 'zh-CN'
}
