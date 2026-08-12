import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import * as path from 'path'
import { resolvePackagedEnginePath } from './PackagedEnginePath'

export interface EngineCommand {
  appPath: string
  prefixArguments: string[]
}

export function resolveBundledEngineCommand(): EngineCommand {
  if (is.dev) {
    const python = process.platform === 'win32'
      ? path.join(app.getAppPath(), 'engine', '.venv', 'Scripts', 'python.exe')
      : path.join(app.getAppPath(), 'engine', '.venv', 'bin', 'python3')
    return {
      appPath: python,
      prefixArguments: [path.join(app.getAppPath(), 'engine', 'main.py')]
    }
  }
  return {
    appPath: resolvePackagedEnginePath(process.platform, process.resourcesPath),
    prefixArguments: []
  }
}
