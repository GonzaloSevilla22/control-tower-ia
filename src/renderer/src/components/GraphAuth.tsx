import { useState, useEffect } from 'react'
import axios from 'axios'

const http = axios.create({ baseURL: 'http://127.0.0.1:8765', timeout: 120000 })

interface AuthStatus {
  client_id_configured: boolean
  authenticated: boolean
}

interface DeviceFlow {
  user_code: string
  verification_uri: string
  message: string
}

export default function GraphAuth() {
  const [status, setStatus]       = useState<AuthStatus | null>(null)
  const [clientId, setClientId]   = useState('')
  const [flow, setFlow]           = useState<DeviceFlow | null>(null)
  const [waiting, setWaiting]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState<string | null>(null)

  const loadStatus = () =>
    http.get('/api/outlook/graph/auth-status')
      .then(r => setStatus(r.data))
      .catch(() => {})

  useEffect(() => { loadStatus() }, [])

  const handleSaveClientId = async () => {
    if (!clientId.trim()) return
    setSaving(true)
    setError(null)
    try {
      await http.post('/api/outlook/graph/setup', { client_id: clientId.trim() })
      setSuccess('Client ID guardado.')
      loadStatus()
    } catch {
      setError('No se pudo guardar el Client ID.')
    } finally {
      setSaving(false)
    }
  }

  const handleStartLogin = async () => {
    setError(null)
    setFlow(null)
    try {
      const r = await http.post('/api/outlook/graph/start-login')
      setFlow(r.data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Error al iniciar login.')
    }
  }

  const handleCompleteLogin = async () => {
    setWaiting(true)
    setError(null)
    try {
      await http.post('/api/outlook/graph/complete-login')
      setSuccess('¡Autenticado con Microsoft! Ya podés sincronizar.')
      setFlow(null)
      loadStatus()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Autenticación fallida. Intentá de nuevo.')
    } finally {
      setWaiting(false)
    }
  }

  const handleLogout = async () => {
    await http.post('/api/outlook/graph/logout').catch(() => {})
    setSuccess('Sesión cerrada.')
    loadStatus()
  }

  const copyCode = () => {
    if (flow) navigator.clipboard.writeText(flow.user_code)
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-y-auto">
      <div className="px-6 py-4 border-b border-slate-700/60">
        <h1 className="text-xl font-semibold text-white">Configuración Microsoft Graph</h1>
        <p className="text-xs text-slate-500 mt-0.5">Conectá con el Nuevo Outlook vía Microsoft Graph API</p>
      </div>

      <div className="flex-1 px-6 py-5 space-y-5 max-w-2xl">

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm flex items-center gap-3">
            <span>⚠️</span><span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">✕</button>
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl px-4 py-3 text-sm flex items-center gap-3">
            <span>✅</span><span>{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto">✕</button>
          </div>
        )}

        {/* Status */}
        {status && (
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-4">
            <div className="flex-1 space-y-1">
              <StatusRow label="Client ID configurado" ok={status.client_id_configured} />
              <StatusRow label="Autenticado con Microsoft" ok={status.authenticated} />
            </div>
            {status.authenticated && (
              <button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 border border-red-500/30 rounded-lg">
                Cerrar sesión
              </button>
            )}
          </div>
        )}

        {/* Step 1 — Azure setup instructions */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">Paso 1 — Registrar app en Azure (una sola vez)</h2>
          <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside">
            <li>Abrí <span className="text-blue-400 font-mono">portal.azure.com</span> e iniciá sesión con tu cuenta Microsoft</li>
            <li>Buscá <strong className="text-slate-300">App registrations</strong> → <strong className="text-slate-300">New registration</strong></li>
            <li>Nombre: <span className="font-mono text-slate-300">Control Tower IA</span> · Tipo: <strong className="text-slate-300">Accounts in any organizational directory and personal accounts</strong></li>
            <li>En <strong className="text-slate-300">Authentication</strong> → Add platform → Mobile/desktop apps → tildá <span className="font-mono text-slate-300">https://login.microsoftonline.com/common/oauth2/nativeclient</span></li>
            <li>En <strong className="text-slate-300">API permissions</strong> → Add → Microsoft Graph → Delegated → <strong className="text-slate-300">Mail.Read</strong></li>
            <li>Copiá el <strong className="text-slate-300">Application (client) ID</strong> de la página Overview</li>
          </ol>
        </div>

        {/* Step 2 — Client ID input */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">Paso 2 — Ingresá el Client ID</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSaveClientId}
              disabled={saving || !clientId.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Step 3 — Login */}
        {status?.client_id_configured && !status?.authenticated && (
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">Paso 3 — Iniciá sesión con Microsoft</h2>
            {!flow ? (
              <button
                onClick={handleStartLogin}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg"
              >
                🔑 Iniciar sesión
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  1. Abrí <a href={flow.verification_uri} target="_blank" rel="noreferrer" className="text-blue-400 underline">{flow.verification_uri}</a> en cualquier browser
                </p>
                <p className="text-xs text-slate-400">2. Ingresá este código:</p>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xl font-bold text-white tracking-widest bg-slate-900 px-4 py-2 rounded-lg border border-slate-600">
                    {flow.user_code}
                  </span>
                  <button onClick={copyCode} className="text-xs text-slate-400 hover:text-white px-3 py-2 border border-slate-600 rounded-lg">
                    📋 Copiar
                  </button>
                </div>
                <p className="text-xs text-slate-400">3. Cuando hayas ingresado el código y aceptado los permisos, hacé click en:</p>
                <button
                  onClick={handleCompleteLogin}
                  disabled={waiting}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
                >
                  {waiting ? '⏳ Verificando...' : '✅ Ya ingresé el código'}
                </button>
              </div>
            )}
          </div>
        )}

        {status?.authenticated && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-sm text-emerald-300">
            ✅ Conectado con Microsoft Graph. El botón "Sincronizar Outlook" del Dashboard va a usar esta conexión automáticamente.
          </div>
        )}
      </div>
    </div>
  )
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-slate-600'}`} />
      <span className="text-slate-400">{label}</span>
      <span className={`ml-auto font-medium ${ok ? 'text-emerald-400' : 'text-slate-500'}`}>
        {ok ? 'OK' : 'Pendiente'}
      </span>
    </div>
  )
}
