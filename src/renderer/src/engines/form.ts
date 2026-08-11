import type { EngineConfig } from '../../../shared/config/schema.ts'
import type { EngineConfigPath, EngineFieldCondition, EngineFieldDescriptor } from './types.ts'

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Engine configuration path does not point to an object')
  }
  return value as Record<string, unknown>
}

export function cloneEngineConfig(config: EngineConfig): EngineConfig {
  return structuredClone(config)
}

export function getEngineConfigValue(config: EngineConfig, path: EngineConfigPath): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    return asRecord(current)[segment]
  }, config)
}

export function setEngineConfigValue(
  config: EngineConfig,
  path: EngineConfigPath,
  value: unknown
): void {
  const segments = path.split('.')
  const finalSegment = segments.pop()
  if (!finalSegment) throw new Error('Engine configuration path is empty')

  const target = segments.reduce<Record<string, unknown>>((current, segment) => {
    return asRecord(current[segment])
  }, config)
  target[finalSegment] = value
}

export function conditionsMatch(
  config: EngineConfig,
  conditions: readonly EngineFieldCondition[] | undefined
): boolean {
  return (
    !conditions ||
    conditions.every((condition) => {
      return getEngineConfigValue(config, condition.path) === condition.equals
    })
  )
}

export function isEngineFieldVisible(config: EngineConfig, field: EngineFieldDescriptor): boolean {
  return conditionsMatch(config, field.visibleWhen)
}

export function isEmptyEngineFieldValue(value: unknown): boolean {
  return typeof value === 'string' ? value.trim() === '' : value === null || value === undefined
}
