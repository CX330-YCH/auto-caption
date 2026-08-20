import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createFontFamilyOptions,
  findMatchingFontOption,
  parseSingleFontFamily,
  serializeFontFamily
} from '../../src/renderer/src/utils/fontFamily.ts'
import {
  loadLocalFontOptions,
  LocalFontQueryError,
  resetLocalFontCacheForTests
} from '../../src/renderer/src/utils/localFonts.ts'

test('serializes generic and quoted font families safely', () => {
  assert.equal(serializeFontFamily('sans-serif'), 'sans-serif')
  assert.equal(serializeFontFamily('Noto Sans CJK SC'), '"Noto Sans CJK SC"')
  assert.equal(serializeFontFamily('Font, Name'), '"Font, Name"')
  assert.equal(serializeFontFamily('Font "A" \\'), '"Font \\"A\\" \\\\"')
})

test('parses one family without mistaking a font stack for one family', () => {
  assert.equal(parseSingleFontFamily(' Arial '), 'Arial')
  assert.equal(parseSingleFontFamily('"Noto Sans CJK SC"'), 'Noto Sans CJK SC')
  assert.equal(parseSingleFontFamily("'Font \\'Name\\''"), "Font 'Name'")
  assert.equal(parseSingleFontFamily('Arial, sans-serif'), undefined)
  assert.equal(parseSingleFontFamily('"unterminated'), undefined)
  assert.equal(parseSingleFontFamily('   '), undefined)
})

test('deduplicates font faces by normalized family and keeps generic choices first', () => {
  const options = createFontFamilyOptions([
    {
      family: 'Noto Sans',
      fullName: 'Noto Sans Regular',
      postscriptName: 'NotoSans-Regular',
      style: 'Regular'
    },
    {
      family: 'noto sans',
      fullName: 'Noto Sans Bold',
      postscriptName: 'NotoSans-Bold',
      style: 'Bold'
    },
    {
      family: '  ',
      fullName: 'Invalid',
      postscriptName: 'Invalid',
      style: 'Regular'
    },
    {
      family: '游ゴシック',
      fullName: '游ゴシック Regular',
      postscriptName: 'YuGothic-Regular',
      style: 'Regular'
    }
  ], 'en')

  assert.deepEqual(options.slice(0, 4).map(option => option.value), [
    'sans-serif',
    'serif',
    'monospace',
    'system-ui'
  ])
  assert.equal(options.filter(option => option.family.toLowerCase() === 'noto sans').length, 1)
  assert.deepEqual(
    options.find(option => option.family === 'Noto Sans')?.styles,
    ['Bold', 'Regular']
  )
  assert.equal(options.some(option => option.family === '游ゴシック'), true)
})

test('matches raw and quoted legacy values while preserving custom stacks', () => {
  const options = createFontFamilyOptions([{
    family: 'Microsoft YaHei',
    fullName: 'Microsoft YaHei',
    postscriptName: 'MicrosoftYaHei',
    style: 'Regular'
  }], 'zh')

  assert.equal(
    findMatchingFontOption('Microsoft YaHei', options)?.value,
    '"Microsoft YaHei"'
  )
  assert.equal(
    findMatchingFontOption('"microsoft yahei"', options)?.family,
    'Microsoft YaHei'
  )
  assert.equal(
    findMatchingFontOption('"Microsoft YaHei", sans-serif', options),
    undefined
  )
})

test('filters a system family whose serialized value exceeds the config limit', () => {
  const oversizedFamily = `Font-${'x'.repeat(260)}`
  const options = createFontFamilyOptions([{
    family: oversizedFamily,
    fullName: oversizedFamily,
    postscriptName: 'OversizedFont',
    style: 'Regular'
  }], 'en')

  assert.equal(options.some(option => option.family === oversizedFamily), false)
})

test('enumerates local fonts once per renderer cache and refreshes on demand', async () => {
  const previousWindow = globalThis.window
  let calls = 0
  globalThis.window = {
    queryLocalFonts: async () => {
      calls += 1
      return [{
        family: `Font ${calls}`,
        fullName: `Font ${calls} Regular`,
        postscriptName: `Font${calls}-Regular`,
        style: 'Regular'
      }]
    }
  }
  resetLocalFontCacheForTests()
  try {
    const first = await loadLocalFontOptions('en')
    const cached = await loadLocalFontOptions('en')
    const refreshed = await loadLocalFontOptions('en', true)
    assert.equal(calls, 2)
    assert.equal(first.some(option => option.family === 'Font 1'), true)
    assert.equal(cached.some(option => option.family === 'Font 1'), true)
    assert.equal(refreshed.some(option => option.family === 'Font 2'), true)
  }
  finally {
    resetLocalFontCacheForTests()
    globalThis.window = previousWindow
  }
})

test('classifies unsupported and denied local font access for manual fallback', async () => {
  const previousWindow = globalThis.window
  resetLocalFontCacheForTests()
  try {
    globalThis.window = {}
    await assert.rejects(
      loadLocalFontOptions('en'),
      error => error instanceof LocalFontQueryError && error.reason === 'unsupported'
    )

    globalThis.window = {
      queryLocalFonts: async () => {
        throw new DOMException('Denied', 'NotAllowedError')
      }
    }
    await assert.rejects(
      loadLocalFontOptions('en'),
      error => error instanceof LocalFontQueryError && error.reason === 'denied'
    )
  }
  finally {
    resetLocalFontCacheForTests()
    globalThis.window = previousWindow
  }
})
