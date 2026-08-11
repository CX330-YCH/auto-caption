import type { EngineDefinition } from '../types.ts'
import { language } from './shared.ts'

export const gummyEngine: EngineDefinition = {
  id: 'gummy',
  labelKey: 'engine.options.providers.gummy',
  capabilities: {
    sourceLanguage: 'selectable',
    translation: 'integrated',
    recording: true,
    hotwords: 'unsupported'
  },
  defaultSourceLanguage: 'auto',
  languages: [
    language('auto', ['source']),
    language('en', ['source', 'target']),
    language('zh', ['source', 'target']),
    language('ja', ['source', 'target']),
    language('ko', ['source', 'target']),
    language('de', ['source']),
    language('fr', ['source']),
    language('ru', ['source']),
    language('es', ['source']),
    language('it', ['source']),
    language('yue', ['source'])
  ],
  providerFields: [
    {
      id: 'gummy-api-key',
      path: 'providers.gummy.apiKey',
      control: 'password',
      section: 'advanced',
      labelKey: 'engine.fields.gummyApiKey',
      helpKey: 'engine.apikeyInfo',
      helpLink: 'https://bailian.console.aliyun.com',
      helpLinkLabelKey: 'engine.fields.openProviderConsole'
    }
  ]
}
