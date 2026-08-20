import {
  createFontFamilyOptions,
  type FontFamilyOption,
  type LocalFontMetadata
} from './fontFamily.ts'

type QueryLocalFonts = () => Promise<LocalFontMetadata[]>
type LocalFontWindow = Window & { queryLocalFonts?: QueryLocalFonts }

export type LocalFontAccessError = 'denied' | 'unsupported' | 'failed'

export class LocalFontQueryError extends Error {
  public readonly reason: LocalFontAccessError

  public constructor(reason: LocalFontAccessError) {
    super(`Unable to enumerate local fonts: ${reason}`)
    this.name = 'LocalFontQueryError'
    this.reason = reason
  }
}

let cachedFonts: LocalFontMetadata[] | undefined
let pendingQuery: Promise<LocalFontMetadata[]> | undefined

function queryFunction(): QueryLocalFonts | undefined {
  return (window as LocalFontWindow).queryLocalFonts?.bind(window)
}

function classifyQueryError(error: unknown): LocalFontAccessError {
  if (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' || error.name === 'SecurityError')
  ) {
    return 'denied'
  }
  return 'failed'
}

async function enumerateLocalFonts(forceRefresh: boolean): Promise<LocalFontMetadata[]> {
  if (!forceRefresh && cachedFonts) return cachedFonts.map(font => ({ ...font }))
  if (!forceRefresh && pendingQuery) {
    return (await pendingQuery).map(font => ({ ...font }))
  }
  const query = queryFunction()
  if (!query) throw new LocalFontQueryError('unsupported')

  pendingQuery = query().then(fonts => fonts.map(font => ({
    family: font.family,
    fullName: font.fullName,
    postscriptName: font.postscriptName,
    style: font.style
  })))
  try {
    cachedFonts = await pendingQuery
    return cachedFonts.map(font => ({ ...font }))
  }
  catch (error) {
    throw new LocalFontQueryError(classifyQueryError(error))
  }
  finally {
    pendingQuery = undefined
  }
}

export async function loadLocalFontOptions(
  locale: string,
  forceRefresh: boolean = false
): Promise<FontFamilyOption[]> {
  const fonts = await enumerateLocalFonts(forceRefresh)
  return createFontFamilyOptions(fonts, locale)
}

export function resetLocalFontCacheForTests(): void {
  cachedFonts = undefined
  pendingQuery = undefined
}
