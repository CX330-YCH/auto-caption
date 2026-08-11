import type { EngineLanguage } from '../types.ts'

const languageLabel = (value: string): string => `engine.options.languages.${value}`

export function language(
  value: string,
  roles: EngineLanguage['roles'],
  labelKey = languageLabel(value)
): EngineLanguage {
  return { value, roles, labelKey }
}
