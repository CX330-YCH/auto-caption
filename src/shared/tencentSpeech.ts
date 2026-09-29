export const TENCENT_SPEECH_MODELS = ['hunyuan-translation-lite', 'hunyuan-translation'] as const

export type TencentSpeechModel = (typeof TENCENT_SPEECH_MODELS)[number]

export const TENCENT_RECOGNITION_MODELS = [
  'Hy-ASR-3.0-preview', '8k_zh_large', '16k_zh_en', '16k_multi_lang',
  '16k_en_large', '8k_zh', '8k_en', '16k_zh', '16k_zh-TW',
  '16k_zh_edu', '16k_zh_medical', '16k_zh_court', '16k_yue',
  '16k_en', '16k_en_game', '16k_en_edu', '16k_ko', '16k_ja',
  '16k_th', '16k_id', '16k_vi', '16k_ms', '16k_fil', '16k_pt',
  '16k_tr', '16k_ar', '16k_es', '16k_hi', '16k_fr', '16k_de'
] as const

export type TencentRecognitionModel = (typeof TENCENT_RECOGNITION_MODELS)[number]

export const TENCENT_RECOGNITION_V2_MODELS = [
  '16k_zh_en_2.0', '16k_zh_en_speaker_2.0'
] as const

export type TencentRecognitionV2Model =
  (typeof TENCENT_RECOGNITION_V2_MODELS)[number]

export const TENCENT_SPEECH_TARGETS_BY_SOURCE = {
  zh: ['zh', 'en', 'ja', 'ko', 'yue', 'id', 'th'],
  en: ['zh', 'en', 'ja', 'ko', 'yue', 'id', 'th'],
  zh_en: ['zh_en', 'zh', 'en', 'ja', 'ko', 'yue', 'id', 'th'],
  ja: ['zh', 'en', 'ja', 'ko', 'yue'],
  ko: ['zh', 'en', 'ja', 'ko', 'yue'],
  yue: ['zh', 'en', 'ja', 'ko', 'yue'],
  id: ['zh', 'en', 'id'],
  th: ['zh', 'en', 'th'],
  ru: ['zh', 'en', 'ru']
} as const satisfies Readonly<Record<string, readonly string[]>>

export interface TencentSpeechCredentials {
  appId: string
  secretId: string
  secretKey: string
}

export function hasTencentSpeechCredentials(credentials: TencentSpeechCredentials): boolean {
  return Boolean(
    credentials.appId.trim() &&
    credentials.secretId.trim() &&
    credentials.secretKey.trim()
  )
}

export function isTencentSpeechLanguagePair(source: string, target: string): boolean {
  const targets =
    TENCENT_SPEECH_TARGETS_BY_SOURCE[source as keyof typeof TENCENT_SPEECH_TARGETS_BY_SOURCE]
  return Boolean((targets as readonly string[] | undefined)?.includes(target))
}
