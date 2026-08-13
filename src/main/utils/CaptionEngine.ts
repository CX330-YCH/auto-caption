import { execFile, spawn } from 'child_process'
import * as net from 'net'
import { controlWindow } from '../ControlWindow'
import { allConfig } from './AllConfig'
import { i18n } from '../i18n'
import { Log } from './Log'
import { passwordMaskingForList } from './UtilsFunc'
import {
  EngineProtocol,
  type EngineProtocolBatch
} from '../engine/protocol/EngineProtocol'
import {
  type EngineMessage,
  isCaptionEngineMessage,
  isContentEngineMessage,
  isTranslationEngineMessage
} from '../engine/protocol/messages'
import {
  buildBundledEngineArguments,
  buildCustomEngineArguments
} from '../engine/config/EngineCommandBuilder'
import { resolveBundledEngineCommand } from '../engine/EngineExecutable'
import {
  getActiveBuiltinProvider,
  getActiveCustomEngine
} from '../../shared/config/schema.ts'
import {
  forceKillProcessTree,
  shouldCreateProcessGroup
} from '../engine/EngineProcessControl.ts'

export class CaptionEngine {
  appPath: string = ''
  command: string[] = []
  process: any | undefined
  client: net.Socket | undefined
  port: number = 8080
  status: 'running' | 'starting' | 'stopping' | 'stopped' | 'starting-timeout' = 'stopped'
  timerID: NodeJS.Timeout | undefined
  startTimeoutID: NodeJS.Timeout | undefined
  private readonly protocol = new EngineProtocol()

  private getApp(): boolean {
    const engineConfig = allConfig.engine
    this.port = Math.floor(Math.random() * (65535 - 1024 + 1)) + 1024
    const customEngine = getActiveCustomEngine(engineConfig)
    const provider = getActiveBuiltinProvider(engineConfig)
    if (customEngine) {
      Log.info('Using customized caption engine')
      this.appPath = customEngine.executable
      this.command = buildCustomEngineArguments(customEngine, this.port)
    }
    else if (provider) {
      if(provider === 'gummy' &&
        !engineConfig.providers.gummy.apiKey && !process.env.DASHSCOPE_API_KEY
      ) {
        controlWindow.sendErrorMessage(i18n('gummy.key.missing'))
        return false
      }
      if(provider === 'fun_asr' &&
        !engineConfig.providers.funAsr.apiKey && !process.env.DASHSCOPE_API_KEY
      ) {
        controlWindow.sendErrorMessage(i18n('fun_asr.key.missing'))
        return false
      }
      const engineCommand = resolveBundledEngineCommand()
      this.appPath = engineCommand.appPath
      this.command = [...engineCommand.prefixArguments]
      this.command.push(...buildBundledEngineArguments(
        engineConfig,
        provider,
        this.port
      ))
    }
    else {
      controlWindow.sendErrorMessage(i18n('engine.selection.invalid'))
      return false
    }
    Log.info('Engine Path:', this.appPath)
    Log.info('Engine Command:', passwordMaskingForList(this.command))
    return true
  }

  public connect(): void {
    if(this.client) { Log.warn('Client already exists, ignoring...') }
    if (this.startTimeoutID) {
      clearTimeout(this.startTimeoutID)
      this.startTimeoutID = undefined
    }
    this.client = net.createConnection({ port: this.port }, () => {
      Log.info('Connected to caption engine server');
    });
    this.status = 'running'
    allConfig.setEngineEnabled(true)
    if(controlWindow.window){
      allConfig.sendEngineState(controlWindow.window)
      controlWindow.window.webContents.send(
        'control.engine.started',
        this.process.pid
      )
    }
  }

  public sendCommand(command: string, content: string = ""): void {
    if(this.client === undefined) {
      Log.error('Client not initialized yet')
      return
    }
    const data = this.protocol.encodeCommand(command, content)
    this.client.write(data);
    Log.info('Send command to Python server:', command)
  }

  public start(): void {
    if (this.status !== 'stopped') {
      Log.warn('Caption engine is not stopped, current status:', this.status)
      return
    }
    if(!this.getApp()){ return }

    this.protocol.reset()
    this.process = spawn(this.appPath, this.command, {
      detached: shouldCreateProcessGroup(process.platform)
    })
    this.process.once('error', (error: Error) => {
      Log.error('Caption engine process failed to start:', error)
      controlWindow.sendErrorMessage(
        `${i18n('engine.start.error')}${error.message}`
      )
    })
    this.status = 'starting'
    Log.info('Caption Engine Starting, PID:', this.process.pid)

    const timeoutSeconds = allConfig.engine.common.startTimeoutSeconds
    const timeoutMs = timeoutSeconds * 1000
    this.startTimeoutID = setTimeout(() => {
      if (this.status === 'starting') {
        Log.warn(`Engine start timeout after ${timeoutSeconds} seconds, forcing kill...`)
        this.status = 'starting-timeout'
        controlWindow.sendErrorMessage(i18n('engine.start.timeout'))
        this.kill()
      }
    }, timeoutMs)
    
    this.process.stdout.on('data', (data: Buffer) => {
      this.handleProtocolBatch(this.protocol.push(data))
    });

    this.process.stderr.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')
      lines.forEach((line: string) => {
        if(line.trim()){
          Log.error(line)       
        }
      })
    });

    this.process.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      this.handleProtocolBatch(this.protocol.finish())
      this.process = undefined;
      this.client = undefined
      allConfig.setEngineEnabled(false)
      if(controlWindow.window){
        allConfig.sendEngineState(controlWindow.window)
        controlWindow.window.webContents.send('control.engine.stopped')
      }
      this.status = 'stopped'
      clearInterval(this.timerID)
      if (this.startTimeoutID) {
        clearTimeout(this.startTimeoutID)
        this.startTimeoutID = undefined
      }
      Log.info('Engine exited', { code, signal })
    });
  }

  public stop(): void {
    if(this.status !== 'running'){
      Log.warn('Trying to stop engine which is not running, current status:', this.status)
    }
    this.sendCommand('stop')
    if(this.client){
      this.client.destroy()
      this.client = undefined
    }
    this.status = 'stopping'
    this.timerID = setTimeout(() => {
      if(this.status !== 'stopping') return
      Log.warn('Engine process still not stopped, trying to kill...')
      this.kill()
    }, 4000);
  }

  public kill(): void {
    if(!this.process || !this.process.pid) return
    if(this.status !== 'running'){
      Log.warn('Trying to kill engine which is not running, current status:', this.status)
    }
    Log.warn('Killing engine process, PID:', this.process.pid)

    if (this.startTimeoutID) {
      clearTimeout(this.startTimeoutID)
      this.startTimeoutID = undefined
    }
    if(this.client){
      this.client.destroy()
      this.client = undefined
    }
    if (this.process.pid) {
      forceKillProcessTree(
        this.process.pid,
        process.platform,
        {
          kill: process.kill,
          taskkill: (pid, callback) => {
            execFile(
              'taskkill',
              ['/pid', pid.toString(), '/t', '/f'],
              (error) => callback(error)
            )
          }
        },
        (error) => {
        if (error) {
          Log.error('Failed to kill process:', error)
        } else {
          Log.info('Process killed successfully')
        }
        }
      )
    }
  }

  private handleProtocolBatch(batch: EngineProtocolBatch): void {
    for (const error of batch.errors) {
      Log.error(
        `Engine protocol ${error.kind} at line ${error.lineNumber}:`,
        error.message
      )
    }

    for (const message of batch.messages) handleEngineData(message)
  }
}

function handleEngineData(data: EngineMessage): void {
  switch (data.command) {
    case 'connect':
      captionEngine.connect()
      return
    case 'kill':
      if(captionEngine.status !== 'stopped') {
        Log.warn('Error occurred, trying to kill caption engine...')
        captionEngine.kill()
      }
      return
    case 'caption':
      if (isCaptionEngineMessage(data)) allConfig.updateCaptionLog(data)
      else Log.error('Invalid caption event received from caption engine')
      return
    case 'translation':
      if (isTranslationEngineMessage(data)) allConfig.updateCaptionTranslation(data)
      else Log.error('Invalid translation event received from caption engine')
      return
    case 'print':
      if (isContentEngineMessage(data)) console.log(data.content)
      else Log.error('Invalid print event received from caption engine')
      return
    case 'info':
      if (isContentEngineMessage(data)) Log.info('Engine Info:', data.content)
      else Log.error('Invalid info event received from caption engine')
      return
    case 'debug':
      if (isContentEngineMessage(data)) Log.debug('Engine Debug:', data)
      else Log.error('Invalid debug event received from caption engine')
      return
    case 'warn':
      if (isContentEngineMessage(data)) Log.warn('Engine Warn:', data.content)
      else Log.error('Invalid warn event received from caption engine')
      return
    case 'error':
      if (isContentEngineMessage(data)) {
        Log.error('Engine Error:', data.content)
        if ('diagnostic' in data) {
          Log.debug('Engine Error Diagnostic:', data.diagnostic)
        }
        controlWindow.sendErrorMessage(data.content)
      }
      else Log.error('Invalid error event received from caption engine')
      return
    case 'usage':
      if (isContentEngineMessage(data)) Log.info('Engine Token Usage:', data.content)
      else Log.error('Invalid usage event received from caption engine')
      return
    default:
      Log.warn('Unknown engine command:', data.command)
  }
}

export const captionEngine = new CaptionEngine()
