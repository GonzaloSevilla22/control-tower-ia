import { useEffect, useState } from 'react'
import { getHealth } from '../api/client'

export type View = 'dashboard' | 'operations' | 'documents' | 'alerts' | 'copilot'

interface NavItem {
  id: View
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',  label: 'Dashboard',      icon: '⬛' },
  { id: 'operations', label: 'Operaciones',    icon: '📦' },
  { id: 'documents',  label: 'Documentos',     icon: '📁' },
  { id: 'alerts',     label: 'Alertas',        icon: '🔔' },
  { id: 'copilot',    label: 'Copiloto IA',    icon: '🤖' }
]

interface Props {
  current: View
  onNavigate: (v: View) => void
}

export default function Sidebar({ current, onNavigate }: Props) {
  const [backendOk, setBackendOk] = useState(false)
  const [outlookOk, setOutlookOk] = useState(false)

  useEffect(() => {
    const check = () =>
      getHealth()
        .then((h) => {
          setBackendOk(h.status === 'ok')
          setOutlookOk(h.outlook_available)
        })
        .catch(() => { setBackendOk(false); setOutlookOk(false) })

    // Esperar 2 s antes del primer check para dar tiempo al backend de iniciar
    const initial = setTimeout(check, 2000)
    const id = setInterval(check, 15000)
    return () => { clearTimeout(initial); clearInterval(id) }
  }, [])

  return (
    <aside className="flex w-56 flex-col bg-slate-900 border-r border-slate-700/60 select-none">
      {/* Logo */}
      <div className="flex flex-col items-center gap-1 px-4 py-5 border-b border-slate-700/60">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white text-lg font-bold shadow-lg">
          CT
        </div>
        <span className="text-white font-semibold text-sm leading-tight text-center">Control Tower IA</span>
        <span className="text-slate-500 text-[10px] uppercase tracking-widest">BLY Argentina</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = current === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Status indicators */}
      <div className="px-3 py-4 border-t border-slate-700/60 space-y-2">
        <StatusDot label="Backend API" ok={backendOk} />
        <StatusDot label="Outlook"     ok={outlookOk} />
      </div>
    </aside>
  )
}

function StatusDot({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${ok ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`ml-auto text-[10px] font-medium ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
        {ok ? 'OK' : 'OFFLINE'}
      </span>
    </div>
  )
}
