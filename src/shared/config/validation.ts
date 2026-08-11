import type { KnownProviderName } from './schema.ts'
import type { UILanguage, UITheme } from '../types'
import { InvalidConfigError } from './schema.ts'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function requireString(
  value: unknown,
  field: string,
  maxLength: number = 4096,
  allowEmpty: boolean = true
): string {
  if (
    typeof value !== 'string' || value.length > maxLength ||
    (!allowEmpty && value.length === 0)
  ) {
    throw new InvalidConfigError(`Invalid ${field}`)
  }
  return value
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new InvalidConfigError(`Invalid ${field}`)
  }
  return value
}

export function requireNumber(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number
): number {
  if (
    typeof value !== 'number' || !Number.isFinite(value) ||
    value < minimum || value > maximum
  ) {
    throw new InvalidConfigError(`Invalid ${field}`)
  }
  return value
}

export function requireLanguage(value: unknown): UILanguage {
  if (value !== 'zh' && value !== 'en' && value !== 'ja') {
    throw new InvalidConfigError('Invalid UI language')
  }
  return value
}

export function requireTheme(value: unknown): UITheme {
  if (value !== 'light' && value !== 'dark' && value !== 'system') {
    throw new InvalidConfigError('Invalid UI theme')
  }
  return value
}

export function requireProvider(value: unknown): KnownProviderName {
  if (
    value !== 'gummy' && value !== 'vosk' &&
    value !== 'sosv' && value !== 'glm'
  ) {
    throw new InvalidConfigError('Invalid Provider')
  }
  return value
}

export function requireColor(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new InvalidConfigError(`Invalid ${field}`)
  }
  return value
}

export function requireUrl(
  value: unknown,
  field: string,
  allowEmpty: boolean = true
): string {
  const text = requireString(value, field, 4096, !allowEmpty)
  if (!text && allowEmpty) return text
  try {
    const parsed = new URL(text)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new InvalidConfigError(`Invalid ${field}`)
    }
  }
  catch (error) {
    if (error instanceof InvalidConfigError) throw error
    throw new InvalidConfigError(`Invalid ${field}`)
  }
  return text
}
