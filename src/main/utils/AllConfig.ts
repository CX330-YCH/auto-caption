import type {
  CaptionItem,
  FullConfig,
  SoftwareLogItem,
  UILanguage,
  UITheme
} from '../types'
import type {
  ApplicationConfig,
  ConfigDocumentV3,
  EngineConfig
} from '../../shared/config/schema'
import {
  CONFIG_SCHEMA_VERSION,
  createDefaultConfig,
  createDefaultStyles
} from '../../shared/config/schema'
import {
  parseApplicationConfig,
  parseCaptionConfig,
  parseConfigDocumentV3,
  parseEngineConfig
} from '../../shared/config/document'
import { Log } from './Log'
import { app, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { hasApplicationConfigChanged } from '../config/ApplicationConfigChange.ts'
import { CaptionLog } from '../engine/captions/CaptionLog.ts'
import type {
  CaptionEngineMessage,
  TranslationEngineMessage
} from '../engine/protocol/messages.ts'

function getDesktopPath(): string {
  return path.join(os.homedir(), 'Desktop')
}

class AllConfig {
  private document: ConfigDocumentV3 = createDefaultConfig(getDesktopPath())
  private readonly captions = new CaptionLog()

  public engineEnabled: boolean = false

  public get captionLog(): CaptionItem[] {
    return this.captions.items
  }

  public get config(): ConfigDocumentV3 {
    return this.document
  }

  public get application(): ApplicationConfig {
    return this.document.application
  }

  public get engine(): EngineConfig {
    return this.document.engine
  }

  public get captionWindowWidth(): number {
    return this.document.application.layout.captionWindowWidth
  }

  public get uiLanguage(): UILanguage {
    return this.document.application.language
  }

  public get uiTheme(): UITheme {
    return this.document.application.theme
  }

  public readConfig(): void {
    const configPath = this.getConfigPath()
    if (!fs.existsSync(configPath)) return
    try {
      const raw: unknown = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      this.document = parseConfigDocumentV3(raw)
      Log.info(
        `Read config schema v${CONFIG_SCHEMA_VERSION} from:`,
        configPath
      )
    }
    catch (error) {
      this.document = createDefaultConfig(getDesktopPath())
      Log.error(
        `Config rejected; V3 defaults will be used (${errorName(error)})`
      )
    }
  }

  public writeConfig(): void {
    const configPath = this.getConfigPath()
    fs.writeFileSync(configPath, JSON.stringify(this.document, null, 2))
    Log.info(`Write config schema v${CONFIG_SCHEMA_VERSION} to:`, configPath)
  }

  public getFullConfig(softwareLog: SoftwareLogItem[]): FullConfig {
    return {
      platform: process.platform,
      config: this.document,
      engineEnabled: this.engineEnabled,
      captionLog: this.captionLog,
      softwareLog
    }
  }

  public setApplication(value: unknown): boolean {
    const application = parseApplicationConfig(value)
    if (!hasApplicationConfigChanged(this.document.application, application)) {
      return false
    }
    this.document = { ...this.document, application }
    Log.debug('Application config changed')
    return true
  }

  public setCaptionWindowWidth(width: unknown): void {
    const application = parseApplicationConfig({
      ...this.document.application,
      layout: {
        ...this.document.application.layout,
        captionWindowWidth: width
      }
    })
    this.document = { ...this.document, application }
  }

  public setCaption(value: unknown): void {
    const caption = parseCaptionConfig(value)
    this.document = { ...this.document, caption }
    Log.info('Set caption config')
  }

  public resetCaptionStyles(): void {
    this.document = {
      ...this.document,
      caption: {
        ...this.document.caption,
        styles: createDefaultStyles()
      }
    }
    Log.info('Reset caption styles')
  }

  public sendCaption(window: BrowserWindow): void {
    window.webContents.send('both.captionConfig.set', this.document.caption)
    Log.info(`Send caption config to #${window.id}`)
  }

  public setEngine(value: unknown): void {
    const engine = parseEngineConfig(value)
    this.document = { ...this.document, engine }
    Log.info('Set active caption engine:', engine.activeEngineId)
  }

  public setEngineEnabled(enabled: boolean): void {
    this.engineEnabled = enabled
  }

  public sendEngineState(window: BrowserWindow): void {
    window.webContents.send('control.engineState.set', this.engineEnabled)
  }

  public updateCaptionLog(
    log: CaptionEngineMessage,
    engineRunId: number
  ): void {
    const change = this.captions.upsert(engineRunId, log)
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('both.captionLog.upsert', change.item)
    }
  }

  public updateCaptionTranslation(
    translation: TranslationEngineMessage,
    engineRunId: number
  ): void {
    const change = this.captions.applyTranslation(engineRunId, translation)
    if (!change) {
      Log.warn('Translation target caption was not found')
      return
    }
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('both.captionLog.upsert', change.item)
    }
  }

  public clearCaptionLog(): void {
    this.captions.clear()
  }

  private getConfigPath(): string {
    return path.join(app.getPath('userData'), 'config.json')
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError'
}

export const allConfig = new AllConfig()
