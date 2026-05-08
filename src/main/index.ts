import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'

let mainWindow: BrowserWindow | null = null
let pythonProcess: ChildProcess | null = null

function spawnPythonBackend(): void {
  if (is.dev) {
    // En desarrollo se inicia con start_dev.bat
    return
  }

  // En producción: PyInstaller generó backend/run.exe dentro de resources
  const backendExe = join(process.resourcesPath, 'backend', 'run.exe')

  if (!existsSync(backendExe)) {
    console.error('[Backend] Executable not found:', backendExe)
    return
  }

  pythonProcess = spawn(backendExe, [], {
    cwd: join(process.resourcesPath, 'backend'),
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

// ── IPC ───────────────────────────────────────────────────
ipcMain.handle('app:version', () => app.getVersion())
ipcMain.handle('shell:openPath', (_e, p: string) => shell.openPath(p))
ipcMain.handle('shell:showItemInFolder', (_e, p: string) => shell.showItemInFolder(p))

// ── Lifecycle ─────────────────────────────────────────────
app.whenReady().then(() => {
  app.setAppUserModelId('com.boartlongyear.controltoweria')
  spawnPythonBackend()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (pythonProcess) { pythonProcess.kill(); pythonProcess = null }
  if (process.platform !== 'darwin') app.quit()
})
