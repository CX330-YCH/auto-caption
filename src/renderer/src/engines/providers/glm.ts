import type { EngineDefinition } from '../types.ts'
import { language } from './shared.ts'

export const glmEngine: EngineDefinition = {
  id: 'glm',
  labelKey: 'engine.options.providers.glm',
  capabilities: {
    sourceLanguage: 'selectable',
    translation: 'external',
    recording: true,
    hotwords: 'unsupported'
  },
  defaultSourceLanguage: 'auto',
  languages: [
    language('auto', ['source']),
    language('en', ['source', 'target']),
    language('zh', ['source', 'target']),
    language('ja', ['source', 'target']),
    language('ko', ['source', 'target'])
  ],
  providerFields: [
    {
      id: 'glm-url',
      path: 'providers.glm.url',
      control: 'text',
      section: 'primary',
      labelKey: 'engine.fields.glmUrl',
      placeholder: 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions',
      defaultWhenEmpty: 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions'
    },
    {
      id: 'glm-model',
      path: 'providers.glm.model',
      control: 'text',
      section: 'primary',
      labelKey: 'engine.fields.glmModel',
      placeholder: 'glm-asr-2512',
      defaultWhenEmpty: 'glm-asr-2512'
    },
    {
      id: 'glm-api-key',
      path: 'providers.glm.apiKey',
      control: 'password',
      section: 'advanced',
      labelKey: 'engine.fields.glmApiKey',
      helpKey: 'engine.glmApikeyInfo',
      helpLink: 'https://open.bigmodel.cn/',
      helpLinkLabelKey: 'engine.fields.openProviderConsole'
    }
  ]
}
