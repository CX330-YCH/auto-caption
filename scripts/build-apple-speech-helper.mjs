import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const packagePath = join(root, 'native', 'apple-speech-helper')
const scratchPath = join(root, '.test-env', 'swift-build')
const cachePath = join(root, '.test-env', 'swift-module-cache')
const environment = {
  ...process.env,
  CLANG_MODULE_CACHE_PATH: cachePath,
  SWIFT_MODULECACHE_PATH: cachePath
}
mkdirSync(cachePath, { recursive: true })

run([
  'build', '--disable-sandbox', '-c', 'release',
  '-debug-info-format', 'none',
  '--package-path', packagePath, '--scratch-path', scratchPath
])
const binPath = run([
  'build', '--disable-sandbox', '-c', 'release', '--package-path', packagePath,
  '-debug-info-format', 'none', '--scratch-path', scratchPath, '--show-bin-path'
]).stdout.trim()
const destination = join(packagePath, 'dist', 'apple-speech-helper')
mkdirSync(dirname(destination), { recursive: true })
copyFileSync(join(binPath, 'apple-speech-helper'), destination)

// The ESLint TypeScript rule cannot express a return type in an .mjs file.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function run(arguments_) {
  const result = spawnSync('swift', arguments_, {
    cwd: root,
    env: environment,
    encoding: 'utf8',
    stdio: arguments_.includes('--show-bin-path') ? 'pipe' : 'inherit'
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
  return result
}
