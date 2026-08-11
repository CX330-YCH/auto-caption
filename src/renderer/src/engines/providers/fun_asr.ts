import type { EngineDefinition } from '../types.ts'
import { validateFunAsrEndpoint } from '../../../../shared/config/validation.ts'
import { language } from './shared.ts'

const missingConfiguration = {
  phase: 'start' as const,
  titleKey: 'noti.funAsrConfigMissing',
  descriptionKey: 'noti.funAsrConfigMissingNote'
}

export const funAsrEngine: EngineDefinition = {
  id: 'fun_asr',
  labelKey: 'engine.options.providers.funAsr',
  capabilities: {
    sourceLanguage: 'selectable',
    translation: 'external',
    recording: true,
    hotwords: 'unsupported'
  },
  defaultSourceLanguage: 'auto',
  validate: (config) => {
    const funAsr = config.providers.funAsr
    if (!funAsr.websocketUrl || !funAsr.workspaceId) return null
    try {
      validateFunAsrEndpoint(funAsr.websocketUrl, funAsr.workspaceId)
      return null
    }
    catch {
      return {
        fieldId: 'fun-asr-websocket-url',
        titleKey: 'noti.funAsrEndpointInvalid',
        descriptionKey: 'noti.funAsrEndpointInvalidNote'
      }
    }
  },
  languages: [
    language('auto', ['source']),
    language('zh', ['source', 'target']),
    language('en', ['source', 'target']),
    language('ja', ['source', 'target']),
    language('ko', ['source', 'target']),
    language('de', ['source', 'target']),
    language('fr', ['source', 'target']),
    language('ru', ['source', 'target']),
    language('es', ['source', 'target']),
    language('it', ['source', 'target'])
  ],
  providerFields: [
    {
      id: 'fun-asr-model',
      path: 'providers.funAsr.model',
      control: 'select',
      section: 'primary',
      labelKey: 'engine.fields.funAsrModel',
      options: [
        {
          value: 'fun-asr-realtime',
          labelKey: 'engine.options.funAsrModels.current'
        },
        {
          value: 'fun-asr-realtime-2025-11-07',
          labelKey: 'engine.options.funAsrModels.snapshot'
        }
      ]
    },
    {
      id: 'fun-asr-workspace',
      path: 'providers.funAsr.workspaceId',
      control: 'text',
      section: 'advanced',
      labelKey: 'engine.fields.funAsrWorkspace',
      helpKey: 'engine.funAsr.workspaceInfo',
      required: missingConfiguration
    },
    {
      id: 'fun-asr-websocket-url',
      path: 'providers.funAsr.websocketUrl',
      control: 'text',
      section: 'advanced',
      labelKey: 'engine.fields.funAsrWebsocketUrl',
      helpKey: 'engine.funAsr.websocketInfo',
      placeholder: 'wss://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference',
      required: missingConfiguration
    },
    {
      id: 'fun-asr-api-key',
      path: 'providers.funAsr.apiKey',
      control: 'password',
      section: 'advanced',
      labelKey: 'engine.fields.funAsrApiKey',
      helpKey: 'engine.funAsr.apiKeyInfo',
      helpLink: 'https://bailian.console.aliyun.com',
      helpLinkLabelKey: 'engine.fields.openProviderConsole'
    },
    {
      id: 'fun-asr-semantic-punctuation',
      path: 'providers.funAsr.semanticPunctuationEnabled',
      control: 'switch',
      section: 'advanced',
      labelKey: 'engine.fields.funAsrSemanticPunctuation',
      helpKey: 'engine.funAsr.semanticPunctuationInfo'
    },
    {
      id: 'fun-asr-max-sentence-silence',
      path: 'providers.funAsr.maxSentenceSilenceMs',
      control: 'number',
      section: 'advanced',
      labelKey: 'engine.fields.funAsrSentenceSilence',
      helpKey: 'engine.funAsr.sentenceSilenceInfo',
      min: 200,
      max: 6000,
      step: 100,
      addonAfterKey: 'engine.milliseconds'
    },
    {
      id: 'fun-asr-heartbeat',
      path: 'providers.funAsr.heartbeatEnabled',
      control: 'switch',
      section: 'advanced',
      labelKey: 'engine.fields.funAsrHeartbeat',
      helpKey: 'engine.funAsr.heartbeatInfo'
    }
  ]
}
