import assert from 'node:assert/strict'
import test from 'node:test'

import { hasApplicationConfigChanged } from '../../src/main/config/ApplicationConfigChange.ts'
import { ApplicationConfigSync } from '../../src/renderer/src/utils/ApplicationConfigSync.ts'
import { createDefaultConfig } from '../../src/shared/config/schema.ts'

test('suppresses unchanged application config updates', () => {
  const current = createDefaultConfig('/tmp').application
  const identical = structuredClone(current)
  const changed = structuredClone(current)
  changed.layout.leftBarWidth += 1

  assert.equal(hasApplicationConfigChanged(current, identical), false)
  assert.equal(hasApplicationConfigChanged(current, changed), true)
})

test('suppresses remote config feedback until Vue finishes flushing', () => {
  const transmissions = []
  const scheduled = []
  const sync = new ApplicationConfigSync(
    () => transmissions.push('sent'),
    (callback) => scheduled.push(callback)
  )

  sync.applyRemote(() => sync.send())
  assert.deepEqual(transmissions, [])

  scheduled.shift()()
  sync.send()
  assert.deepEqual(transmissions, ['sent'])
})

test('an older remote flush cannot reopen a newer synchronization window', () => {
  const transmissions = []
  const scheduled = []
  const sync = new ApplicationConfigSync(
    () => transmissions.push('sent'),
    (callback) => scheduled.push(callback)
  )

  sync.applyRemote(() => {})
  sync.applyRemote(() => {})
  scheduled[0]()
  sync.send()
  assert.deepEqual(transmissions, [])

  scheduled[1]()
  sync.send()
  assert.deepEqual(transmissions, ['sent'])
})
