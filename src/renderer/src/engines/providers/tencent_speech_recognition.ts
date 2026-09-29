import {
  TENCENT_RECOGNITION_MODELS,
  TENCENT_RECOGNITION_V2_MODELS
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
  languages: [language('auto', ['source']), ...targetLanguages],
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
      options: modelOptions(TENCENT_RECOGNITION_MODELS)
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
  languages: [language('auto', ['source']), ...targetLanguages],
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
