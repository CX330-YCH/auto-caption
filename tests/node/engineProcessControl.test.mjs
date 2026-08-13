import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import test from 'node:test'

import {
  forceKillProcessTree,
  shouldCreateProcessGroup
} from '../../src/main/engine/EngineProcessControl.ts'

test('creates independent process groups only on POSIX', () => {
  assert.equal(shouldCreateProcessGroup('darwin'), true)
  assert.equal(shouldCreateProcessGroup('linux'), true)
  assert.equal(shouldCreateProcessGroup('win32'), false)
})

test('force kill targets the complete POSIX process group', () => {
  const kills = []
  let result

  forceKillProcessTree(321, 'darwin', {
    kill: (pid, signal) => kills.push([pid, signal]),
    taskkill: () => assert.fail('taskkill should not run on POSIX')
  }, (error) => { result = error })

  assert.deepEqual(kills, [[-321, 'SIGKILL']])
  assert.equal(result, null)
})

test('force kill uses taskkill tree mode dependency on Windows', () => {
  const taskkills = []

  forceKillProcessTree(654, 'win32', {
    kill: () => assert.fail('POSIX kill should not run on Windows'),
    taskkill: (pid, callback) => {
      taskkills.push(pid)
      callback(null)
    }
  }, (error) => assert.equal(error, null))

  assert.deepEqual(taskkills, [654])
})

test('rejects unsafe process identifiers before invoking a killer', () => {
  let result

  forceKillProcessTree(0, 'linux', {
    kill: () => assert.fail('kill should not run for an invalid PID'),
    taskkill: () => assert.fail('taskkill should not run for an invalid PID')
  }, (error) => { result = error })

  assert.match(result.message, /Invalid engine process ID/)
})

test('kills a real POSIX parent and grandchild process group', {
  skip: process.platform === 'win32',
  timeout: 10000
}, async () => {
  const parentScript = [
    "const { spawn } = require('node:child_process')",
    "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })",
    'process.stdout.write(`${child.pid}\\n`)',
    'setInterval(() => {}, 1000)'
  ].join(';')
  const parent = spawn(process.execPath, ['-e', parentScript], {
    detached: true,
    stdio: ['ignore', 'pipe', 'inherit']
  })
  assert.ok(parent.pid)
  let grandchildPid

  try {
    const [chunk] = await once(parent.stdout, 'data')
    grandchildPid = Number.parseInt(chunk.toString().trim(), 10)
    assert.ok(Number.isSafeInteger(grandchildPid) && grandchildPid > 0)

    const killError = await new Promise((resolve) => {
      forceKillProcessTree(parent.pid, process.platform, {
        kill: process.kill,
        taskkill: () => assert.fail('taskkill should not run on POSIX')
      }, resolve)
    })
    assert.equal(killError, null)
    await once(parent, 'close')
    await waitUntilProcessExits(grandchildPid)

    assert.equal(isProcessAlive(parent.pid), false)
    assert.equal(isProcessAlive(grandchildPid), false)
  }
  finally {
    for (const pid of [grandchildPid, parent.pid]) {
      if (pid && isProcessAlive(pid)) {
        try {
          process.kill(pid, 'SIGKILL')
        }
        catch (error) {
          assert.equal(error?.code, 'ESRCH')
        }
      }
    }
  }
})

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    if (error?.code === 'ESRCH') return false
    throw error
  }
}

async function waitUntilProcessExits(pid) {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  assert.fail(`process ${pid} remained alive after process-group kill`)
}
