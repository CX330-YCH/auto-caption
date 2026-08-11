import type { EngineDefinition } from '../types.ts'
import { language } from './shared.ts'

export const voskEngine: EngineDefinition = {
  id: 'vosk',
  labelKey: 'engine.options.providers.vosk',
  capabilities: {
    sourceLanguage: 'model-defined',
    translation: 'external',
    recording: true,
    hotwords: 'unsupported'
  },
  defaultSourceLanguage: 'auto',
  languages: [
    language('auto', ['source'], 'engine.options.languages.modelDefined'),
    language('en', ['target']),
    language('zh-cn', ['target'], 'engine.options.languages.zh'),
    language('ja', ['target']),
    language('ko', ['target']),
    language('de', ['target']),
    language('fr', ['target']),
    language('ru', ['target']),
    language('es', ['target']),
    language('it', ['target'])
  ],
  providerFields: [
    {
      id: 'vosk-model-path',
      path: 'providers.vosk.modelPath',
      control: 'directory',
      section: 'advanced',
      labelKey: 'engine.voskModelPath',
      helpKey: 'engine.voskModelPathInfo',
      helpLink: 'https://alphacephei.com/vosk/models',
      helpLinkLabelKey: 'engine.modelDownload',
      required: {
        phase: 'start',
        titleKey: 'noti.empty',
        descriptionKey: 'noti.emptyInfo'
      }
    }
  ]
}
