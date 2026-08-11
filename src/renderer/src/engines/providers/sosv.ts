import type { EngineDefinition } from '../types.ts'
import { language } from './shared.ts'

export const sosvEngine: EngineDefinition = {
  id: 'sosv',
  labelKey: 'engine.options.providers.sosv',
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
    language('ko', ['source', 'target']),
    language('yue', ['source']),
    language('de', ['target']),
    language('fr', ['target']),
    language('ru', ['target']),
    language('es', ['target']),
    language('it', ['target'])
  ],
  providerFields: [
    {
      id: 'sosv-model-path',
      path: 'providers.sosv.modelPath',
      control: 'directory',
      section: 'advanced',
      labelKey: 'engine.sosvModelPath',
      helpKey: 'engine.sosvModelPathInfo',
      helpLink: 'https://github.com/HiMeditator/auto-caption/releases/tag/sosv-model',
      helpLinkLabelKey: 'engine.modelDownload',
      required: {
        phase: 'start',
        titleKey: 'noti.empty',
        descriptionKey: 'noti.emptyInfo'
      }
    }
  ]
}
