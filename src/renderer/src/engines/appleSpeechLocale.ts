import { normalizeAppleSpeechLocale } from '../../../shared/appleSpeech.ts'

type Translate = (key: string) => string

const APPLE_SPEECH_LOCALE_NAME_KEYS: Readonly<Record<string, string>> = {
  'zh-CN': 'engine.appleSpeech.localeNames.zhCN',
  'zh-HK': 'engine.appleSpeech.localeNames.zhHK',
  'zh-TW': 'engine.appleSpeech.localeNames.zhTW',
  'yue-CN': 'engine.appleSpeech.localeNames.yueCN'
}

export function appleSpeechLocaleDisplayName(
  locale: string,
  uiLanguage: string,
  translate: Translate
): string {
  const normalized = normalizeAppleSpeechLocale(locale)
  const messageKey = APPLE_SPEECH_LOCALE_NAME_KEYS[normalized]
  if (messageKey) return translate(messageKey)
  try {
    return new Intl.DisplayNames([uiLanguage], { type: 'language' }).of(normalized) ?? normalized
  }
  catch {
    return normalized
  }
}
