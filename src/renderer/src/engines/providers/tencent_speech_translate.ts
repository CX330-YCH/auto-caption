import type { EngineDefinition } from '../types.ts'
import {
  TENCENT_SPEECH_TARGETS_BY_SOURCE,
  isTencentSpeechLanguagePair
} from '../../../../shared/tencentSpeech.ts'
import { language } from './shared.ts'

const sourceLanguages = Object.keys(TENCENT_SPEECH_TARGETS_BY_SOURCE)
const allLanguages = [
  ...new Set([...sourceLanguages, ...Object.values(TENCENT_SPEECH_TARGETS_BY_SOURCE).flat()])
]

export const tencentSpeechTranslateEngine: EngineDefinition = {
  id: 'tencent_speech_translate',
  labelKey: 'engine.options.providers.tencentSpeechTranslate',
  capabilities: {
    sourceLanguage: 'selectable',
    translation: 'integrated',
    translationRequired: true,
    recording: true,
    hotwords: 'unsupported'
  },
  defaultSourceLanguage: 'zh',
  languages: allLanguages.map((value) =>
    language(value, sourceLanguages.includes(value) ? ['source', 'target'] : ['target'])
  ),
  targetLanguagesBySource: TENCENT_SPEECH_TARGETS_BY_SOURCE,
  providerFields: [
    {
      id: 'tencent-speech-model',
      path: 'providers.tencentSpeech.model',
      control: 'select',
      section: 'primary',
      labelKey: 'engine.fields.tencentSpeechModel',
      helpKey: 'engine.tencentSpeech.credentialsInfo',
      helpLink: 'https://cloud.tencent.com/document/product/1093/127565',
      helpLinkLabelKey: 'engine.fields.openProviderDocs',
      options: [
        {
          value: 'hunyuan-translation-lite',
          labelKey: 'engine.options.tencentSpeechModels.lite'
        },
        {
          value: 'hunyuan-translation',
          labelKey: 'engine.options.tencentSpeechModels.standard'
        }
      ]
    },
    {
      id: 'tencent-speech-vad-silence',
      path: 'providers.tencentSpeech.vadSilenceMs',
      control: 'number',
      section: 'advanced',
      labelKey: 'engine.fields.tencentSpeechVadSilence',
      helpKey: 'engine.tencentSpeech.vadSilenceInfo',
      min: 500,
      max: 2000,
      step: 100,
      addonAfterKey: 'engine.milliseconds',
      sourceLanguages: ['zh', 'en', 'zh_en']
    },
    {
      id: 'tencent-speech-max-speak-time',
      path: 'providers.tencentSpeech.maxSpeakTimeMs',
      control: 'number',
      section: 'advanced',
      labelKey: 'engine.fields.tencentSpeechMaxSpeakTime',
      helpKey: 'engine.tencentSpeech.maxSpeakTimeInfo',
      min: 5000,
      max: 90000,
      step: 1000,
      addonAfterKey: 'engine.milliseconds',
      sourceLanguages: ['zh', 'en', 'zh_en']
    }
  ],
  validate: (config) =>
    isTencentSpeechLanguagePair(
      config.common.sourceLanguage,
      config.translation.common.targetLanguage
    )
      ? null
      : {
          fieldId: 'translation-target-language',
          titleKey: 'noti.tencentSpeechLanguagePairInvalid',
          descriptionKey: 'noti.tencentSpeechLanguagePairInvalidNote'
        }
}
