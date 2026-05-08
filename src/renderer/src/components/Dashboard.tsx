import { useEffect, useState, useCallback } from 'react'
import { getStats, syncOutlook } from '../api/client'
import type { DashboardStats, SyncResult } from '../types'
import type { View } from './Sidebar'

interface Props {
  onNavigate: (v: View) => void
}

export default function Dashboard({ onNavigate }: Props) {
  const [stats, setStats]         = useState<DashboardStats | null>(null)
  const [syncing, setSyncing]     = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [error, setError]         = useState<string | null>(null)

  const loadStats = useCallback(() => {
    getStats()
      .then(setStats)
      .catch(() => setError('No se pudo conectar al backend. Verifica que el servidor Python esté corriendo.'))
  }, [])

  useEffect(() => {
    loadStats()
    const id = setInterval(loadStats, 30000)
    return () => clearInterval(id)
  }, [loadStats])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await syncOutlook(30)
      setSyncResult(result)
      loadStats()
    } catch {
      setError('Error al sincronizar con Outlook. Asegúrate de que Outlook esté abierto.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 bg-slate-900 sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {stats?.last_sync
              ? `Última sincronización: ${new Date(stats.last_sync).toLocaleString('es-AR')}`
              : 'Sin sincronizar aún'}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-600/20"
        >
          <span className={syncing ? 'animate-spin' : ''}>🔄</span>
          {syncing ? 'Sincronizando...' : 'Sincronizar Outlook'}
        </button>
      </div>

      <div className="flex-1 px-6 py-5 space-y-6">
        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm flex items-start gap-3">
            <span className="mt-0.5">⚠️</span>
            <div>
              <p className="font-medium">Error de conexión</p>
              <p className="text-red-400/80 text-xs mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200">✕</button>
          </div>
        )}

        {/* Sync result */}
        {syncResult && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl px-4 py-3 text-sm flex items-center gap-3">
            <span>✅</span>
            <span>
              Sincronización completa — <strong>{syncResult.synced}</strong> correos procesados,{' '}
              <strong>{syncResult.new_operations}</strong> nuevas operaciones,{' '}
              <strong>{syncResult.updated}</strong> actualizadas
            </span>
            <button onClick={() => setSyncResult(null)} className="ml-auto text-emerald-400">✕</button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Total Operaciones"
            value={stats?.total_ops ?? '—'}
            icon="📦"
            color="blue"
            onClick={() => onNavigate('operations')}
          />
          <KPICard
            label="Activas"
            value={stats?.active ?? '—'}
            icon="🟢"
            color="emerald"
            onClick={() => onNavigate('operations')}
          />
          <KPICard
            label="Con Demora"
            value={stats?.delayed ?? '—'}
            icon="⚠️"
            color="amber"
            onClick={() => onNavigate('alerts')}
          />
          <KPICard
            label="Docs Pendientes"
            value={stats?.pending_docs ?? '—'}
            icon="📄"
            color="red"
            onClick={() => onNavigate('operations')}
          />
        </div>

        {/* Status breakdown */}
        <div className="grid grid-cols-3 gap-4">
          <MiniCard label="En Tránsito"    value={stats?.in_transit ?? '—'} icon="🚢" />
          <MiniCard label="En Aduana"      value={stats?.at_customs ?? '—'} icon="🛃" />
          <MiniCard label="Entregadas"     value={stats?.delivered ?? '—'}  icon="✅" />
        </div>

        {/* Quick actions */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Acciones Rápidas</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.label}
                onClick={a.id === 'sync' ? handleSync : () => onNavigate(a.view as View)}
                className="flex items-start gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-left border border-slate-700/50 hover:border-slate-600"
              >
                <span className="text-xl mt-0.5">{a.icon}</span>
                <div>
                  <p className="text-xs font-medium text-slate-200">{a.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{a.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  blue:   'from-blue-600/20 to-blue-500/5 border-blue-500/30 text-blue-400',
  emerald:'from-emerald-600/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400',
  amber:  'from-amber-600/20 to-amber-500/5 border-amber-500/30 text-amber-400',
  red:    'from-red-600/20 to-red-500/5 border-red-500/30 text-red-400'
}

function KPICard({
  label, value, icon, color, onClick
}: {
  label: string; value: number | string; icon: string; color: string; onClick?: () => void
}) {
  const cls = COLOR_MAP[color] ?? COLOR_MAP.blue
  return (
    <button
      onClick={onClick}
      className={`bg-gradient-to-br ${cls} border rounded-2xl p-4 text-left hover:scale-[1.02] transition-transform`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </button>
  )
}

function MiniCard({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3 flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-lg font-bold text-white">{value}</p>
        <p className="text-[11px] text-slate-500">{label}</p>
      </div>
    </div>
  )
}

const QUICK_ACTIONS = [
  { id: 'sync',       label: 'Sincronizar Outlook',     desc: 'Leer correos nuevos',          icon: '🔄', view: 'dashboard' },
  { id: 'operations', label: 'Ver Operaciones',         desc: 'Lista completa con filtros',   icon: '📦', view: 'operations' },
  { id: 'alerts',     label: 'Revisar Alertas',         desc: 'Demoras y pendientes',         icon: '🔔', view: 'alerts' },
  { id: 'documents',  label: 'Gestionar Documentos',    desc: 'Adjuntos por operación',       icon: '📁', view: 'documents' },
  { id: 'copilot',    label: 'Consultar Copiloto IA',   desc: 'Sugerencias y acciones',       icon: '🤖', view: 'copilot' },
]
