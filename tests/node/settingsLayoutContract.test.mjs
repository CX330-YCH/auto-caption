import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parse } from 'vue-eslint-parser'

const settingComponentFiles = [
  'src/renderer/src/components/GeneralSetting.vue',
  'src/renderer/src/components/EngineControl.vue',
  'src/renderer/src/components/CaptionStyle.vue',
  'src/renderer/src/components/engine/EngineSelector.vue',
  'src/renderer/src/components/engine/EngineFieldRenderer.vue',
  'src/renderer/src/components/engine/HotwordManager.vue'
]

const fieldOwnerFiles = settingComponentFiles.filter(
  (file) => !file.endsWith('EngineSelector.vue') && !file.endsWith('EngineFieldRenderer.vue')
)

const formControlNames = new Set([
  'a-input',
  'a-input-number',
  'a-radio-group',
  'a-select',
  'a-slider',
  'a-switch',
  'a-textarea',
  'fontfamilyselect'
])

const retiredClassNames = new Set([
  'input-item',
  'input-label',
  'input-area',
  'input-item-value',
  'switch-list',
  'switch-option',
  'switch-label',
  'responsive-radio-group'
])

function readSource(file) {
  return readFileSync(file, 'utf8')
}

function templateElements(file) {
  const templateOnlySource = readSource(file).replace(/<script[\s\S]*?<\/script>/g, '')
  const ast = parse(templateOnlySource, { sourceType: 'module' })
  const elements = []

  function visit(node) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'VElement') elements.push(node)
    for (const [key, value] of Object.entries(node)) {
      if (key === 'parent') continue
      if (Array.isArray(value)) value.forEach(visit)
      else visit(value)
    }
  }

  visit(ast.templateBody)
  return elements
}

function sourceClassNames(source) {
  return [...source.matchAll(/\bclass="([^"]*)"/g)].flatMap((match) =>
    match[1].split(/\s+/).filter(Boolean)
  )
}

function hasAncestor(element, rawName) {
  let ancestor = element.parent
  while (ancestor) {
    if (ancestor.type === 'VElement' && ancestor.rawName === rawName) return true
    ancestor = ancestor.parent
  }
  return false
}

function hasAttribute(element, attributeName) {
  return element.startTag.attributes.some(
    (attribute) =>
      attribute.type === 'VAttribute' &&
      !attribute.directive &&
      attribute.key.name === attributeName
  )
}

test('centralizes settings form width, responsive and switch alignment rules', () => {
  const formSource = readSource('src/renderer/src/components/settings/SettingsForm.vue')
  const fieldSource = readSource('src/renderer/src/components/settings/SettingsField.vue')

  assert.match(formSource, /--settings-form-max-width:\s*640px/)
  assert.match(formSource, /container-name:\s*settings-form/)
  assert.match(fieldSource, /@container settings-form \(max-width:\s*480px\)/)
  assert.match(
    fieldSource,
    /\.settings-field--switch\s*>\s*\.settings-field__label[\s\S]*?text-align:\s*start/
  )
})

test('keeps legacy and component-specific settings grids out of setting components', () => {
  for (const file of settingComponentFiles) {
    const source = readSource(file)
    assert.doesNotMatch(source, /input\.css/, `${file} imports the retired form stylesheet`)
    assert.equal(
      sourceClassNames(source).some((className) => retiredClassNames.has(className)),
      false,
      `${file} uses a retired form layout class`
    )
    assert.doesNotMatch(
      source,
      /grid-template-columns\s*:/,
      `${file} defines a component-specific field grid`
    )
  }
})

test('requires setting controls to use the shared field boundary', () => {
  for (const file of fieldOwnerFiles) {
    for (const element of templateElements(file)) {
      if (!formControlNames.has(element.rawName)) continue
      if (!hasAncestor(element, 'a-card')) continue
      if (hasAttribute(element, 'data-settings-layout-exempt')) continue
      assert.equal(
        hasAncestor(element, 'SettingsField'),
        true,
        `${file} contains <${element.rawName}> outside SettingsField`
      )
    }
  }
})

test('keeps shared fields and metadata renderers inside shared forms', () => {
  for (const file of fieldOwnerFiles) {
    for (const element of templateElements(file)) {
      if (element.rawName === 'SettingsField') {
        assert.equal(
          hasAncestor(element, 'SettingsForm'),
          true,
          `${file} contains SettingsField outside SettingsForm`
        )
      }
      if (element.rawName === 'EngineSelector' || element.rawName === 'EngineFieldRenderer') {
        assert.equal(
          hasAncestor(element, 'SettingsForm'),
          true,
          `${file} contains ${element.rawName} outside SettingsForm`
        )
      }
    }
  }

  for (const file of [
    'src/renderer/src/components/engine/EngineSelector.vue',
    'src/renderer/src/components/engine/EngineFieldRenderer.vue'
  ]) {
    assert.ok(
      templateElements(file).some((element) => element.rawName === 'SettingsField'),
      `${file} does not expose the shared field boundary`
    )
  }

  const rendererSource = readSource('src/renderer/src/components/engine/EngineFieldRenderer.vue')
  assert.match(rendererSource, /field\.control === 'switch' \? 'switch' : 'standard'/)
  assert.match(rendererSource, /field\.control === 'switch' \? 'intrinsic' : 'fill'/)
})
