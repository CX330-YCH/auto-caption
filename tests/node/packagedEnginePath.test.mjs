import assert from 'node:assert/strict'
import test from 'node:test'

import { resolvePackagedEnginePath } from '../../src/main/engine/PackagedEnginePath.ts'

test('resolves the packaged engine executable for each platform', () => {
  const resourcesPath = '/app/resources'

  assert.equal(
    resolvePackagedEnginePath('darwin', resourcesPath),
    '/app/resources/engine/main'
  )
  assert.equal(
    resolvePackagedEnginePath('linux', resourcesPath),
    '/app/resources/engine/main'
  )
  assert.equal(
    resolvePackagedEnginePath('win32', resourcesPath),
    '/app/resources/engine/main.exe'
  )
})
