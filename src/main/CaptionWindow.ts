import { shell, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../build/icon.png?asset'
import { controlWindow } from './ControlWindow'
import { allConfig } from './utils/AllConfig'
import {
  CAPTION_WINDOW_INITIAL_HEIGHT,
  CAPTION_WINDOW_MAX_WIDTH,
  CAPTION_WINDOW_MIN_WIDTH,
  lockCaptionWindowHeight
} from './CaptionWindowGeometry'

class CaptionWindow {
  window: BrowserWindow | undefined;

  public createWindow(): void {
    this.window = new BrowserWindow({
      icon: icon,
      width: allConfig.captionWindowWidth,
      height: CAPTION_WINDOW_INITIAL_HEIGHT,
      minWidth: CAPTION_WINDOW_MIN_WIDTH,
      maxWidth: CAPTION_WINDOW_MAX_WIDTH,
      minHeight: CAPTION_WINDOW_INITIAL_HEIGHT,
      maxHeight: CAPTION_WINDOW_INITIAL_HEIGHT,
      show: false,
      frame: false,
      transparent: true,
      center: true,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    this.window.setAlwaysOnTop(true, 'screen-saver')

    this.window.on('ready-to-show', () => {
      this.window?.show()
    })

    this.window.on('close', () => {
      if(this.window) {
        allConfig.setCaptionWindowWidth(this.window.getBounds().width)
      }
    })

    this.window.on('closed', () => {
      this.window = undefined
    })

    this.window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/#/caption`)
    } else {
      this.window.loadFile(path.join(__dirname, '../renderer/index.html'), {
        hash: 'caption'
      })
    }
  }

  public handleMessage() {
    ipcMain.on('caption.controlWindow.activate', () => {
      if(!controlWindow.window){
        controlWindow.createWindow()
      }
      else {
        controlWindow.window.show()
      }
    })

    ipcMain.on('caption.windowHeight.change', (event, height) => {
      const window = this.window
      if (!window || event.sender !== window.webContents) return
      lockCaptionWindowHeight(window, height)
    })

    ipcMain.on('caption.window.close', () => {
      if(this.window){
        this.window.close()
      }
    })

    ipcMain.on('caption.mouseEvents.ignore', (_, ignore: boolean) => {
      if(this.window){
        this.window.setIgnoreMouseEvents(ignore, { forward: ignore })
      }
    })
  }
}

export const captionWindow = new CaptionWindow()
