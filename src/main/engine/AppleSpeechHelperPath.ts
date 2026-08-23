import { app } from 'electron'
import { existsSync } from 'node:fs'
import path from 'node:path'

export function appleSpeechHelperCandidates(): string[] {
  if (app.isPackaged) {
    return [path.join(process.resourcesPath, 'apple-speech', 'apple-speech-helper')]
  }
  const root = app.getAppPath()
  return [
    path.join(root, 'native/apple-speech-helper/dist/apple-speech-helper'),
    path.join(root, 'native/apple-speech-helper/.build/release/apple-speech-helper'),
    path.join(root, 'native/apple-speech-helper/.build/out/Products/Release/apple-speech-helper'),
    path.join(root, 'native/apple-speech-helper/.build/debug/apple-speech-helper'),
    path.join(root, 'native/apple-speech-helper/.build/out/Products/Debug/apple-speech-helper')
  ]
}

export function resolveAppleSpeechHelperPath(): string | undefined {
  return appleSpeechHelperCandidates().find(existsSync)
}
