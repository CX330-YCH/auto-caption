function passwordMasking(pwd: string) {
  return pwd.replace(/./g, '*')
}

const SENSITIVE_KEY = /(api.?key|token|password|secret|authorization|credential|cookie)/i
const SENSITIVE_ARGUMENTS = new Set(['-k', '-okey', '-gkey', '-fkey'])

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
      /([?&](?:api_?key|token|password|secret)=)[^&\s]+/gi,
      '$1<redacted>'
    )
    .replace(
      /\b(?:api.?key|token|password|secret|credential)[-_:=\s]+[A-Za-z0-9._-]{4,}/gi,
      '<redacted>'
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
  seen: WeakSet<object>
): unknown {
  if (SENSITIVE_KEY.test(key)) {
    return typeof value === 'string' && value.length === 0
      ? ''
      : '<redacted>'
  }
  if (typeof value === 'string') return redactSensitiveText(value, secrets)
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'symbol' || typeof value === 'function') {
    return String(value)
  }
  if (typeof value === 'object' && value !== null) {
    if (seen.has(value)) return '<circular>'
    seen.add(value)
  }
  if (Array.isArray(value)) {
    const redacted = value.map((item) => (
      redactValue(item, '', secrets, seen)
    ))
    for (let index = 1; index < redacted.length; index++) {
      if (typeof value[index - 1] === 'string' &&
          SENSITIVE_ARGUMENTS.has(value[index - 1])) {
        redacted[index] = '<redacted>'
      }
    }
    return redacted
  }
  if (value instanceof Error) {
    const properties = Object.fromEntries(
      Object.getOwnPropertyNames(value)
        .filter((property) => !['name', 'message', 'stack'].includes(property))
        .map((property) => [
          property,
          redactValue(
            (value as unknown as Record<string, unknown>)[property],
            property,
            secrets,
            seen
          )
        ])
    )
    return {
      name: value.name,
      message: redactSensitiveText(value.message, secrets),
      stack: value.stack
        ? redactSensitiveText(value.stack, secrets)
        : undefined,
      ...properties
    }
  }
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Map) {
    return Object.fromEntries([...value.entries()].map(([mapKey, mapValue]) => [
      String(mapKey),
      redactValue(mapValue, String(mapKey), secrets, seen)
    ]))
  }
  if (value instanceof Set) {
    return [...value].map((item) => redactValue(item, '', secrets, seen))
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactValue(childValue, childKey, secrets, seen)
      ])
    )
  }
  return value
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
