import type { KnownProviderName } from '../../../shared/config/schema.ts'

export interface EngineLaunchContext {
  environment: NodeJS.ProcessEnv
  secrets: string[]
  stopTimeoutMs: number
}

type LaunchPolicy = (environment: NodeJS.ProcessEnv) => EngineLaunchContext

const policies: Partial<Record<KnownProviderName, LaunchPolicy>> = {
  tencent_speech_translate: (environment) => ({
    environment: { ...environment },
    secrets: [],
    stopTimeoutMs: 8000
  })
}

export function buildEngineLaunchContext(
  provider: KnownProviderName | null,
  environment: NodeJS.ProcessEnv
): EngineLaunchContext {
  const policy = provider ? policies[provider] : undefined
  return policy
    ? policy(environment)
    : {
        environment: { ...environment },
        secrets: [],
        stopTimeoutMs: 4000
      }
}
