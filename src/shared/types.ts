export type UILanguage = 'zh' | 'en' | 'ja'

export type UITheme = 'light' | 'dark' | 'system'

export interface Styles {
  [key: string]: unknown
  lineNumber: number
  lineBreak: number
  fontFamily: string
  fontSize: number
  fontColor: string
  fontWeight: number
  background: string
  opacity: number
  showPreview: boolean
  transDisplay: boolean
  transFontFamily: string
  transFontSize: number
  transFontColor: string
  transFontWeight: number
  textShadow: boolean
  offsetX: number
  offsetY: number
  blur: number
  textShadowColor: string
}

export interface CaptionItem {
  captionId: string
  index: number
  time_s: string
  time_t: string
  text: string
  translation: string
}

export interface SoftwareLogItem {
  type: 'INFO' | 'WARN' | 'ERROR'
  index: number
  time: string
  text: string
}

export interface FullConfig {
  platform: string
  config: import('./config/schema').ConfigDocumentV3
  engineEnabled: boolean
  captionLog: CaptionItem[]
  softwareLog: SoftwareLogItem[]
}

export interface EngineInfo {
  pid: number
  ppid: number
  port: number
  cpu: number
  mem: number
  elapsed: number
}
