import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const localPython = process.platform === 'win32'
  ? join(repositoryRoot, 'engine', '.venv', 'Scripts', 'python.exe')
  : join(repositoryRoot, 'engine', '.venv', 'bin', 'python3')
const pythonCommand = existsSync(localPython)
  ? localPython
  : process.platform === 'win32' ? 'python' : 'python3'

const result = spawnSync(
  pythonCommand,
  ['-m', 'unittest', 'discover', '-s', 'engine/tests', '-p', 'test_*.py', '-v'],
  {
    cwd: repositoryRoot,
    stdio: 'inherit'
  }
)

if (result.error) {
  console.error(`Unable to start Python test runner: ${result.error.message}`)
  process.exitCode = 1
} else {
  process.exitCode = result.status ?? 1
}
