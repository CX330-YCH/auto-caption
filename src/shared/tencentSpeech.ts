export const TENCENT_SPEECH_MODELS = ['hunyuan-translation-lite', 'hunyuan-translation'] as const

export type TencentSpeechModel = (typeof TENCENT_SPEECH_MODELS)[number]

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

export const TENCENT_SPEECH_CREDENTIAL_ENV = {
  appId: 'TENCENTCLOUD_APP_ID',
  secretId: 'TENCENTCLOUD_SECRET_ID',
  secretKey: 'TENCENTCLOUD_SECRET_KEY'
} as const

export function hasTencentSpeechCredentials(environment: NodeJS.ProcessEnv): boolean {
  return Object.values(TENCENT_SPEECH_CREDENTIAL_ENV).every((name) =>
    Boolean(environment[name]?.trim())
  )
}

export function isTencentSpeechLanguagePair(source: string, target: string): boolean {
  const targets =
    TENCENT_SPEECH_TARGETS_BY_SOURCE[source as keyof typeof TENCENT_SPEECH_TARGETS_BY_SOURCE]
  return Boolean((targets as readonly string[] | undefined)?.includes(target))
}
