import { app, BrowserWindow, protocol, net } from 'electron'
import path from 'path'
import fs from 'fs'
import { initDatabase, closeDatabase } from './database'
import { registerIpcHandlers } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'VideoSifter - 视频素材筛选',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // 允许加载本地文件（视频、缩略图）
    },
  })

  // 为本地文件服务
  mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    // 放行所有 file:// 请求
    callback({ cancel: false })
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.commandLine.appendSwitch('allow-file-access-from-files')

app.whenReady().then(async () => {
  // 注册自定义协议用于本地文件访问
  protocol.registerFileProtocol('local-file', (request, callback) => {
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''))
    callback({ path: filePath })
  })

  await initDatabase()
  registerIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  closeDatabase()
  // 退出时清理缓存
  const cacheDir = path.join(app.getPath('userData'), 'thumbnails')
  try { fs.rmSync(cacheDir, { recursive: true, force: true }) } catch {}
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
