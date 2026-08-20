export const GENERIC_FONT_FAMILIES = [
  'sans-serif',
  'serif',
  'monospace',
  'system-ui'
] as const

export interface LocalFontMetadata {
  family: string
  fullName: string
  postscriptName: string
  style: string
}

export interface FontFamilyOption {
  family: string
  value: string
  generic: boolean
  styles: string[]
}

function normalizedFamilyKey(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase()
}

export function serializeFontFamily(family: string): string {
  if (
    GENERIC_FONT_FAMILIES.includes(
      family as typeof GENERIC_FONT_FAMILIES[number]
    )
  ) {
    return family
  }
  return `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function parseSingleFontFamily(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (
    GENERIC_FONT_FAMILIES.includes(
      trimmed as typeof GENERIC_FONT_FAMILIES[number]
    )
  ) {
    return trimmed
  }

  const quote = trimmed[0]
  if (quote === '"' || quote === "'") {
    if (trimmed.length < 2 || trimmed[trimmed.length - 1] !== quote) {
      return undefined
    }
    let family = ''
    for (let index = 1; index < trimmed.length - 1; index += 1) {
      const character = trimmed[index]
      if (character === quote) return undefined
      if (character === '\\') {
        index += 1
        if (index >= trimmed.length - 1) return undefined
        family += trimmed[index]
      }
      else {
        family += character
      }
    }
    return family || undefined
  }

  if (trimmed.includes(',') || trimmed.includes('"') || trimmed.includes("'")) {
    return undefined
  }
  return trimmed
}

export function createFontFamilyOptions(
  fonts: readonly LocalFontMetadata[],
  locale: string
): FontFamilyOption[] {
  const families = new Map<string, { family: string; styles: Set<string> }>()
  for (const font of fonts) {
    const family = font.family.normalize('NFC').trim()
    if (!family) continue
    const value = serializeFontFamily(family)
    if (value.length > 256) continue
    const key = normalizedFamilyKey(family)
    const existing = families.get(key)
    if (existing) {
      if (font.style.trim()) existing.styles.add(font.style.trim())
      continue
    }
    families.set(key, {
      family,
      styles: new Set(font.style.trim() ? [font.style.trim()] : [])
    })
  }

  const collator = new Intl.Collator(locale, {
    sensitivity: 'base',
    numeric: true
  })
  const localOptions = Array.from(families.values())
    .sort((left, right) => collator.compare(left.family, right.family))
    .map(({ family, styles }) => ({
      family,
      value: serializeFontFamily(family),
      generic: false,
      styles: Array.from(styles).sort(collator.compare)
    }))

  return [
    ...GENERIC_FONT_FAMILIES.map(family => ({
      family,
      value: family,
      generic: true,
      styles: []
    })),
    ...localOptions
  ]
}

export function findMatchingFontOption(
  value: string,
  options: readonly FontFamilyOption[]
): FontFamilyOption | undefined {
  const family = parseSingleFontFamily(value)
  if (!family) return undefined
  const key = normalizedFamilyKey(family)
  return options.find(option => normalizedFamilyKey(option.family) === key)
}

export function isValidFontFamilyValue(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 256) return false
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
    return true
  }
  return CSS.supports('font-family', trimmed)
}
