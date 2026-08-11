import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const testDirectory = join(repositoryRoot, 'tests', 'node')
const testFiles = readdirSync(testDirectory)
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => join(testDirectory, name))

if (testFiles.length === 0) {
  console.error('No Node.js test files were found.')
  process.exitCode = 1
} else {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--test', ...testFiles],
    {
      cwd: repositoryRoot,
      stdio: 'inherit'
    }
  )

  if (result.error) {
    console.error(`Unable to start Node.js test runner: ${result.error.message}`)
    process.exitCode = 1
  } else {
    process.exitCode = result.status ?? 1
  }
}
