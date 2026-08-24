function passwordMasking(pwd: string) {
  return pwd.replace(/./g, '*')
}

const SENSITIVE_KEY = /(?:api.?key|(?:access|refresh|auth|id)?token|password|secret|authorization|credentials?|cookie|set.?cookie)(?:$|[_-]?(?:value|header))$/i
const SENSITIVE_ARGUMENTS = new Set(['-k', '-okey', '-gkey', '-fkey'])
const MAX_DIAGNOSTIC_DEPTH = 16
const MAX_DIAGNOSTIC_ITEMS = 4096
const MAX_DIAGNOSTIC_STRING_LENGTH = 32 * 1024 * 1024

export function redactSensitiveText(
  value: string,
  secrets: readonly string[] = []
): string {
  let redacted = value
  for (const secret of [...secrets].filter(Boolean).sort(
    (left, right) => right.length - left.length
  )) {
    redacted = redacted.split(secret).join('<redacted>')
  }
  return redacted
    .replace(/\bsk-(?:sp-)?[A-Za-z0-9_-]{8,}\b/g, '<redacted>')
    .replace(/\bBearer\s+[^\s"']+/gi, 'Bearer <redacted>')
    .replace(
      /(\b(?:authorization|proxy-authorization)\b["']?\s*[:=]\s*["']?(?:Basic|Digest)\s+)[^\s"',;}]+/gi,
      '$1<redacted>'
    )
    .replace(
      /(\b(?:cookie|set-cookie)\b["']?\s*[:=]\s*["']?)[^\r\n"'}]+/gi,
      '$1<redacted>'
    )
    .replace(
      /([?&](?:api_?key|token|password|secret)=)[^&\s]+/gi,
      '$1<redacted>'
    )
    .replace(
      /(\b(?:api.?key|token|password|secret|credential)\b["']?\s*[:=]\s*["']?)[^\s"',;}]+/gi,
      '$1<redacted>'
    )
    .replace(
      /(\b(?:api.?key|token|password|secret|credential)\b\s+)[A-Za-z0-9._-]{8,}/gi,
      '$1<redacted>'
    )
}

export function redactSensitiveValue(
  value: unknown,
  secrets: readonly string[] = []
): unknown {
  return redactValue(value, '', secrets, new WeakSet<object>())
}

function redactValue(
  value: unknown,
  key: string,
  secrets: readonly string[],
  seen: WeakSet<object>,
  depth = 0
): unknown {
  if (SENSITIVE_KEY.test(key)) {
    return typeof value === 'string' && value.length === 0
      ? ''
      : '<redacted>'
  }
  if (typeof value === 'string') {
    return truncateDiagnosticString(redactSensitiveText(value, secrets))
  }
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'symbol' || typeof value === 'function') {
    return String(value)
  }
  if (Buffer.isBuffer(value)) {
    return { type: 'Buffer', byteLength: value.byteLength }
  }
  if (value instanceof ArrayBuffer) {
    return { type: 'ArrayBuffer', byteLength: value.byteLength }
  }
  if (ArrayBuffer.isView(value)) {
    return {
      type: value.constructor.name,
      byteLength: value.byteLength
    }
  }
  if (typeof value === 'object' && value !== null) {
    if (depth >= MAX_DIAGNOSTIC_DEPTH) return '<max-depth-exceeded>'
    if (seen.has(value)) return '<circular>'
    seen.add(value)
  }
  try {
    if (Array.isArray(value)) {
      const redacted = value.slice(0, MAX_DIAGNOSTIC_ITEMS).map((item) => (
        redactValue(item, '', secrets, seen, depth + 1)
      ))
      for (let index = 1; index < redacted.length; index++) {
        if (typeof value[index - 1] === 'string' &&
            SENSITIVE_ARGUMENTS.has(value[index - 1])) {
          redacted[index] = '<redacted>'
        }
      }
      if (value.length > MAX_DIAGNOSTIC_ITEMS) {
        redacted.push(`<${value.length - MAX_DIAGNOSTIC_ITEMS} items omitted>`)
      }
      return redacted
    }
    if (value instanceof Error) {
      const properties = Object.fromEntries(
        Object.getOwnPropertyNames(value)
          .filter((property) => !['name', 'message', 'stack'].includes(property))
          .slice(0, MAX_DIAGNOSTIC_ITEMS)
          .map((property) => [
            property,
            redactValue(
              (value as unknown as Record<string, unknown>)[property],
              property,
              secrets,
              seen,
              depth + 1
            )
          ])
      )
      return {
        name: value.name,
        message: truncateDiagnosticString(
          redactSensitiveText(value.message, secrets)
        ),
        stack: value.stack
          ? truncateDiagnosticString(redactSensitiveText(value.stack, secrets))
          : undefined,
        ...properties
      }
    }
    if (value instanceof Date) return value.toISOString()
    if (value instanceof Map) {
      const entries = [...value.entries()].slice(0, MAX_DIAGNOSTIC_ITEMS)
      const redacted = Object.fromEntries(entries.map(([mapKey, mapValue]) => [
        String(mapKey),
        redactValue(mapValue, String(mapKey), secrets, seen, depth + 1)
      ]))
      if (value.size > MAX_DIAGNOSTIC_ITEMS) {
        redacted['<omitted>'] = value.size - MAX_DIAGNOSTIC_ITEMS
      }
      return redacted
    }
    if (value instanceof Set) {
      const redacted = [...value].slice(0, MAX_DIAGNOSTIC_ITEMS).map(
        (item) => redactValue(item, '', secrets, seen, depth + 1)
      )
      if (value.size > MAX_DIAGNOSTIC_ITEMS) {
        redacted.push(`<${value.size - MAX_DIAGNOSTIC_ITEMS} items omitted>`)
      }
      return redacted
    }
    if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value)
      const redacted = Object.fromEntries(
        entries.slice(0, MAX_DIAGNOSTIC_ITEMS).map(([childKey, childValue]) => [
          childKey,
          redactValue(childValue, childKey, secrets, seen, depth + 1)
        ])
      )
      if (entries.length > MAX_DIAGNOSTIC_ITEMS) {
        redacted['<omitted>'] = entries.length - MAX_DIAGNOSTIC_ITEMS
      }
      return redacted
    }
    return value
  }
  finally {
    if (typeof value === 'object' && value !== null) seen.delete(value)
  }
}

function truncateDiagnosticString(value: string): string {
  if (value.length <= MAX_DIAGNOSTIC_STRING_LENGTH) return value
  const omitted = value.length - MAX_DIAGNOSTIC_STRING_LENGTH
  return `${value.slice(0, MAX_DIAGNOSTIC_STRING_LENGTH)}<${omitted} characters omitted>`
}

export function sensitiveArgumentValues(args: readonly string[]): string[] {
  const values: string[] = []
  for (let index = 1; index < args.length; index++) {
    if (SENSITIVE_ARGUMENTS.has(args[index - 1]) && args[index]) {
      values.push(args[index])
    }
  }
  return values
}

export function passwordMaskingForList(args: string[]) {
  const maskedArgs = [...args]
  for(let i = 1; i < maskedArgs.length; i++) {
    if(SENSITIVE_ARGUMENTS.has(maskedArgs[i-1])) {
      maskedArgs[i] = passwordMasking(maskedArgs[i])
    }
  }
  return maskedArgs
}

export function passwordMaskingForObject(args: Record<string, any>) {
  const maskedArgs = {...args}
  for(const key in maskedArgs) {
    const lKey = key.toLowerCase()
    if(lKey.includes('api') && lKey.includes('key')) {
      maskedArgs[key] = passwordMasking(maskedArgs[key])
    }
  }
  return maskedArgs
}
