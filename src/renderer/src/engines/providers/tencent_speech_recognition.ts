import {
  TENCENT_RECOGNITION_MODELS,
  TENCENT_RECOGNITION_V2_MODELS,
  type TencentRecognitionModel
} from '../../../../shared/tencentSpeech.ts'
import type {
  EngineDefinition,
  EngineFieldDescriptor,
  EngineFieldOption
} from '../types.ts'
import { language } from './shared.ts'

const missingCredentials = {
  phase: 'start' as const,
  titleKey: 'noti.tencentSpeechCredentialsMissing',
  descriptionKey: 'noti.tencentSpeechCredentialsMissingNote'
}

const credentialFields: readonly EngineFieldDescriptor[] = [
  {
    id: 'tencent-speech-app-id',
    path: 'providers.tencentSpeech.appId',
    control: 'text',
    section: 'advanced',
    labelKey: 'engine.fields.tencentSpeechAppId',
    helpKey: 'engine.tencentSpeech.credentialsInfo',
    required: missingCredentials
  },
  {
    id: 'tencent-speech-secret-id',
    path: 'providers.tencentSpeech.secretId',
    control: 'text',
    section: 'advanced',
    labelKey: 'engine.fields.tencentSpeechSecretId',
    required: missingCredentials
  },
  {
    id: 'tencent-speech-secret-key',
    path: 'providers.tencentSpeech.secretKey',
    control: 'password',
    section: 'advanced',
    labelKey: 'engine.fields.tencentSpeechSecretKey',
    helpLink: 'https://console.cloud.tencent.com/cam/capi',
    helpLinkLabelKey: 'engine.fields.openProviderConsole',
    required: missingCredentials
  }
]

interface ModelPresentation {
  groupKey: string
  labelKey: string
}

const classicModelPresentation = {
  'Hy-ASR-3.0-preview': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.large20',
    labelKey: 'engine.options.tencentRecognitionModels.hyAsr30Preview'
  },
  '8k_zh_large': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.large10',
    labelKey: 'engine.options.tencentRecognitionModels.chineseTelephoneLarge'
  },
  '16k_zh_en': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.large10',
    labelKey: 'engine.options.tencentRecognitionModels.chineseEnglishLarge'
  },
  '16k_multi_lang': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.large10',
    labelKey: 'engine.options.tencentRecognitionModels.multilingualLarge'
  },
  '16k_en_large': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.large10',
    labelKey: 'engine.options.tencentRecognitionModels.englishLarge'
  },
  '8k_zh': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.telephony',
    labelKey: 'engine.options.tencentRecognitionModels.chineseTelephone'
  },
  '8k_en': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.telephony',
    labelKey: 'engine.options.tencentRecognitionModels.englishTelephone'
  },
  '16k_zh': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.chinese',
    labelKey: 'engine.options.tencentRecognitionModels.chineseGeneral'
  },
  '16k_zh-TW': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.chinese',
    labelKey: 'engine.options.tencentRecognitionModels.traditionalChinese'
  },
  '16k_yue': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.chinese',
    labelKey: 'engine.options.languages.yue'
  },
  '16k_zh_edu': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.industry',
    labelKey: 'engine.options.tencentRecognitionModels.chineseEducation'
  },
  '16k_zh_medical': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.industry',
    labelKey: 'engine.options.tencentRecognitionModels.chineseMedical'
  },
  '16k_zh_court': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.industry',
    labelKey: 'engine.options.tencentRecognitionModels.chineseCourt'
  },
  '16k_en_game': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.industry',
    labelKey: 'engine.options.tencentRecognitionModels.englishGame'
  },
  '16k_en_edu': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.industry',
    labelKey: 'engine.options.tencentRecognitionModels.englishEducation'
  },
  '16k_en': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.monolingual',
    labelKey: 'engine.options.languages.en'
  },
  '16k_ko': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.monolingual',
    labelKey: 'engine.options.languages.ko'
  },
  '16k_ja': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.monolingual',
    labelKey: 'engine.options.languages.ja'
  },
  '16k_th': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.monolingual',
    labelKey: 'engine.options.languages.th'
  },
  '16k_id': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.monolingual',
    labelKey: 'engine.options.languages.id'
  },
  '16k_vi': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.monolingual',
    labelKey: 'engine.options.languages.vi'
  },
  '16k_ms': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.monolingual',
    labelKey: 'engine.options.languages.ms'
  },
  '16k_fil': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.monolingual',
    labelKey: 'engine.options.languages.fil'
  },
  '16k_pt': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.monolingual',
    labelKey: 'engine.options.languages.pt'
  },
  '16k_tr': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.monolingual',
    labelKey: 'engine.options.languages.tr'
  },
  '16k_ar': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.monolingual',
    labelKey: 'engine.options.languages.ar'
  },
  '16k_es': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.monolingual',
    labelKey: 'engine.options.languages.es'
  },
  '16k_hi': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.monolingual',
    labelKey: 'engine.options.languages.hi'
  },
  '16k_fr': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.monolingual',
    labelKey: 'engine.options.languages.fr'
  },
  '16k_de': {
    groupKey: 'engine.options.tencentRecognitionModelGroups.monolingual',
    labelKey: 'engine.options.languages.de'
  }
} satisfies Record<TencentRecognitionModel, ModelPresentation>

const classicModelOptions = (): EngineFieldOption[] =>
  TENCENT_RECOGNITION_MODELS.map((value) => ({
    value,
    ...classicModelPresentation[value],
    labelSuffix: value
  }))

const modelOptions = (values: readonly string[]): EngineFieldOption[] =>
  values.map((value) => ({
    value,
    labelKey: 'engine.options.tencentRecognitionModels.model',
    label: value
  }))

const targetLanguages = [
  'zh', 'en', 'ja', 'ko', 'yue', 'id', 'th', 'vi', 'ms', 'fil', 'ru', 'it',
  'pt', 'tr', 'ar', 'es', 'hi', 'fr', 'de'
].map((value) => language(value, ['target']))

export const tencentSpeechRecognitionEngine: EngineDefinition = {
  id: 'tencent_speech_recognition',
  labelKey: 'engine.options.providers.tencentSpeechRecognition',
  capabilities: {
    sourceLanguage: 'model-defined',
    translation: 'external',
    recording: true,
    hotwords: 'unsupported'
  },
  defaultSourceLanguage: 'auto',
  sourceLanguageDescriptionKey: 'engine.tencentSpeech.modelDefinedSourceLanguage',
  languages: [
    language('auto', ['source'], 'engine.options.languages.modelDefined'),
    ...targetLanguages
  ],
  providerFields: [
    {
      id: 'tencent-recognition-model',
      path: 'providers.tencentRecognition.model',
      control: 'select',
      section: 'primary',
      labelKey: 'engine.fields.tencentRecognitionModel',
      helpKey: 'engine.tencentSpeech.recognitionModelInfo',
      helpLink: 'https://cloud.tencent.com/document/product/1093/48982',
      helpLinkLabelKey: 'engine.fields.openProviderDocs',
      options: classicModelOptions(),
      searchable: true
    },
    ...credentialFields,
    {
      id: 'tencent-recognition-vad-silence',
      path: 'providers.tencentRecognition.vadSilenceMs',
      control: 'number',
      section: 'advanced',
      labelKey: 'engine.fields.tencentSpeechVadSilence',
      helpKey: 'engine.tencentSpeech.recognitionVadInfo',
      min: 240,
      max: 2000,
      step: 100,
      addonAfterKey: 'engine.milliseconds'
    },
    {
      id: 'tencent-recognition-max-speak-time',
      path: 'providers.tencentRecognition.maxSpeakTimeMs',
      control: 'number',
      section: 'advanced',
      labelKey: 'engine.fields.tencentSpeechMaxSpeakTime',
      helpKey: 'engine.tencentSpeech.recognitionMaxSpeakInfo',
      min: 5000,
      max: 90000,
      step: 1000,
      addonAfterKey: 'engine.milliseconds'
    }
  ]
}

export const tencentSpeechRecognitionV2Engine: EngineDefinition = {
  id: 'tencent_speech_recognition_v2',
  labelKey: 'engine.options.providers.tencentSpeechRecognitionV2',
  capabilities: {
    sourceLanguage: 'model-defined',
    translation: 'external',
    recording: true,
    hotwords: 'unsupported'
  },
  defaultSourceLanguage: 'auto',
  sourceLanguageDescriptionKey: 'engine.tencentSpeech.modelDefinedSourceLanguage',
  languages: [
    language('auto', ['source'], 'engine.options.languages.modelDefined'),
    ...targetLanguages
  ],
  providerFields: [
    {
      id: 'tencent-recognition-v2-model',
      path: 'providers.tencentRecognitionV2.model',
      control: 'select',
      section: 'primary',
      labelKey: 'engine.fields.tencentRecognitionV2Model',
      helpKey: 'engine.tencentSpeech.recognitionV2ModelInfo',
      helpLink: 'https://cloud.tencent.com/document/product/1093/131127',
      helpLinkLabelKey: 'engine.fields.openProviderDocs',
      options: modelOptions(TENCENT_RECOGNITION_V2_MODELS)
    },
    ...credentialFields,
    {
      id: 'tencent-recognition-v2-vad-silence',
      path: 'providers.tencentRecognitionV2.vadSilenceMs',
      control: 'number',
      section: 'advanced',
      labelKey: 'engine.fields.tencentSpeechVadSilence',
      helpKey: 'engine.tencentSpeech.recognitionVadInfo',
      min: 240,
      max: 2000,
      step: 100,
      addonAfterKey: 'engine.milliseconds'
    },
    {
      id: 'tencent-recognition-v2-sentence-strategy',
      path: 'providers.tencentRecognitionV2.sentenceStrategy',
      control: 'select',
      section: 'advanced',
      labelKey: 'engine.fields.tencentRecognitionSentenceStrategy',
      helpKey: 'engine.tencentSpeech.sentenceStrategyInfo',
      options: [
        {
          value: 0,
          labelKey: 'engine.options.tencentSentenceStrategies.vad'
        },
        {
          value: 1,
          labelKey: 'engine.options.tencentSentenceStrategies.semantic'
        }
      ]
    }
  ]
}
