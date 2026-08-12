import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import * as path from 'path'

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
    appPath: process.platform === 'win32'
      ? path.join(process.resourcesPath, 'engine', 'main.exe')
      : path.join(process.resourcesPath, 'engine', 'main', 'main'),
    prefixArguments: []
  }
}
