import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'

let mainWindow: BrowserWindow | null = null
let pythonProcess: ChildProcess | null = null

function spawnPythonBackend(): void {
  if (is.dev) {
    // En desarrollo el backend se inicia con start_dev.bat
    return
  }

  const backendPath = join(process.resourcesPath, 'backend')
  const venvPython = join(backendPath, 'venv', 'Scripts', 'python.exe')
  const runScript = join(backendPath, 'run.py')

  const pythonExe = existsSync(venvPython) ? venvPython : 'python'

  pythonProcess = spawn(pythonExe, [runScript], {
    cwd: backendPath,
    detached: false,
    stdio: 'pipe'
  })

  pythonProcess.stdout?.on('data', (d) => console.log('[Backend]', d.toString().trim()))
  pythonProcess.stderr?.on('data', (d) => console.error('[Backend ERR]', d.toString().trim()))
  pythonProcess.on('exit', (code) => console.log('[Backend] exited with code', code))
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    title: 'Control Tower IA',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
    if (is.dev) mainWindow!.webContents.openDevTools({ mode: 'detach' })
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── IPC Handlers ──────────────────────────────────────────
ipcMain.handle('app:version', () => app.getVersion())

ipcMain.handle('shell:openPath', (_event, filePath: string) => {
  shell.openPath(filePath)
})

ipcMain.handle('shell:showItemInFolder', (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
})

// ── App lifecycle ─────────────────────────────────────────
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.boartlongyear.controltoweria')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  spawnPythonBackend()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
  }
  if (process.platform !== 'darwin') app.quit()
})
