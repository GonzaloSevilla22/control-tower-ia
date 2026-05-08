import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'

let mainWindow: BrowserWindow | null = null
let pythonProcess: ChildProcess | null = null

// ── Backend spawn ─────────────────────────────────────────
function spawnPythonBackend(): boolean {
  if (is.dev) return true   // en dev lo inicia start_dev.bat

  const backendExe = join(process.resourcesPath, 'backend', 'run.exe')

  if (!existsSync(backendExe)) {
    console.error('[Backend] run.exe not found at:', backendExe)
    return false
  }

  pythonProcess = spawn(backendExe, [], {
    cwd: join(process.resourcesPath, 'backend'),
    detached: false,
    stdio: 'pipe'
  })

  pythonProcess.stdout?.on('data', (d) => console.log('[Backend]', d.toString().trim()))
  pythonProcess.stderr?.on('data', (d) => console.error('[Backend ERR]', d.toString().trim()))
  pythonProcess.on('exit', (code) => {
    console.log('[Backend] exited with code', code)
    // Si el backend muere, notificar a la ventana
    mainWindow?.webContents.send('backend:died')
  })

  return true
}

// ── Wait for backend ──────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitForBackend(maxMs = 40000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch('http://127.0.0.1:8765/api/health', { signal: AbortSignal.timeout(2000) })
      if (res.ok) return true
    } catch {
      // backend todavía no está listo
    }
    await sleep(600)
  }
  return false
}

// ── Loading window ────────────────────────────────────────
function createLoadingWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 400,
    height: 260,
    resizable: false,
    frame: false,
    center: true,
    backgroundColor: '#0f172a',
    show: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })

  win.loadURL(`data:text/html,
    <html>
    <head><meta charset="utf-8">
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;
           display:flex;flex-direction:column;align-items:center;justify-content:center;
           height:100vh;gap:20px;user-select:none}
      .logo{width:56px;height:56px;background:#2563eb;border-radius:14px;
            display:flex;align-items:center;justify-content:center;
            font-size:22px;font-weight:700;color:#fff;letter-spacing:-1px}
      h1{font-size:18px;font-weight:600}
      p{font-size:12px;color:#64748b}
      .dots{display:flex;gap:6px;margin-top:4px}
      .dot{width:8px;height:8px;border-radius:50%;background:#3b82f6;
           animation:bounce 1.2s infinite}
      .dot:nth-child(2){animation-delay:.2s}
      .dot:nth-child(3){animation-delay:.4s}
      @keyframes bounce{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}
    </style></head>
    <body>
      <div class="logo">CT</div>
      <h1>Control Tower IA</h1>
      <p>Iniciando backend...</p>
      <div class="dots">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
      </div>
    </body></html>
  `)
  return win
}

// ── Main window ───────────────────────────────────────────
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

  mainWindow.on('ready-to-show', () => mainWindow!.show())

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
ipcMain.handle('app:version',              () => app.getVersion())
ipcMain.handle('shell:openPath',           (_e, p: string) => shell.openPath(p))
ipcMain.handle('shell:showItemInFolder',   (_e, p: string) => shell.showItemInFolder(p))

// ── Lifecycle ─────────────────────────────────────────────
app.whenReady().then(async () => {
  app.setAppUserModelId('com.boartlongyear.controltoweria')

  const spawned = spawnPythonBackend()

  if (!is.dev && spawned) {
    // Mostrar pantalla de carga mientras el backend arranca
    const loader = createLoadingWindow()
    const ready = await waitForBackend(40000)
    loader.close()

    if (!ready) {
      // Backend no respondió en 40 s — abrir igual y mostrar error en UI
      console.error('[Backend] Did not respond in 40 s')
    }
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (pythonProcess) { pythonProcess.kill(); pythonProcess = null }
  if (process.platform !== 'darwin') app.quit()
})
