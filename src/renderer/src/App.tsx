import { useState } from 'react'
import Sidebar, { type View } from './components/Sidebar'
import Dashboard from './components/Dashboard'
import OperationsList from './components/OperationsList'
import OperationDetail from './components/OperationDetail'

export default function App() {
  const [view, setView]           = useState<View>('dashboard')
  const [selectedOpId, setSelectedOpId] = useState<number | null>(null)

  const handleSelectOp = (id: number) => {
    setSelectedOpId(id)
    setView('operations')
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      <Sidebar current={view} onNavigate={(v) => { setView(v) }} />

      <main className="flex flex-1 overflow-hidden">
        {view === 'dashboard' && (
          <div className="flex-1 overflow-hidden">
            <Dashboard onNavigate={(v) => { setView(v) }} />
          </div>
        )}

        {view === 'operations' && (
          <>
            <div className={`flex flex-col overflow-hidden transition-all duration-200 ${selectedOpId ? 'w-1/2' : 'flex-1'}`}>
              <OperationsList
                selectedId={selectedOpId}
                onSelect={handleSelectOp}
              />
            </div>
            {selectedOpId && (
              <div className="w-1/2 overflow-hidden">
                <OperationDetail
                  operationId={selectedOpId}
                  onClose={() => setSelectedOpId(null)}
                />
              </div>
            )}
          </>
        )}

        {view === 'documents' && <PlaceholderView icon="📁" title="Gestión Documental" desc="Disponible en Etapa 4" />}
        {view === 'alerts'    && <PlaceholderView icon="🔔" title="Alertas Críticas"   desc="Disponible en Etapa 3" />}
        {view === 'copilot'   && <PlaceholderView icon="🤖" title="Copiloto IA"        desc="Disponible en Etapa 5 (requiere Ollama)" />}
      </main>
    </div>
  )
}

function PlaceholderView({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 text-center px-8">
      <span className="text-6xl mb-4">{icon}</span>
      <h2 className="text-2xl font-semibold text-white mb-2">{title}</h2>
      <p className="text-slate-500 text-sm max-w-xs">{desc}</p>
      <div className="mt-6 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-400">
        Consulta el roadmap para el plan de implementación
      </div>
    </div>
  )
}
