import { isDeepStrictEqual } from 'node:util'
import type { ApplicationConfig } from '../../shared/config/schema.ts'

export function hasApplicationConfigChanged(
  current: ApplicationConfig,
  next: ApplicationConfig
): boolean {
  return !isDeepStrictEqual(current, next)
}
