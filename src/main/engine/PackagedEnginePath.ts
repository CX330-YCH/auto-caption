import * as path from 'path'

export function resolvePackagedEnginePath(
  platform: NodeJS.Platform,
  resourcesPath: string
): string {
  return platform === 'win32'
    ? path.join(resourcesPath, 'engine', 'main.exe')
    : path.join(resourcesPath, 'engine', 'main')
}
