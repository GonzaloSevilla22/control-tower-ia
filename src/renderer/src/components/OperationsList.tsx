import { useEffect, useState, useCallback } from 'react'
import { getOperations } from '../api/client'
import type { Operation, OperationStatus } from '../types'
import StatusBadge from './StatusBadge'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'en_consolidacion',    label: 'En Consolidación' },
  { value: 'aprobado_aduana',     label: 'Aprobado Aduana' },
  { value: 'intervencion_aduana', label: 'Intervención Aduana' },
  { value: 'en_transito',         label: 'En Tránsito' },
  { value: 'detenida_aduana',     label: 'Detenida en Aduana' },
  { value: 'liberada_aduana',     label: 'Liberada de Aduana' },
  { value: 'entregada_warehouse', label: 'Entregada Warehouse' },
  { value: 'enviada_costeo',      label: 'Enviada a Costeo' }
]

interface Props {
  selectedId: number | null
  onSelect: (id: number) => void
}

export default function OperationsList({ selectedId, onSelect }: Props) {
  const [ops, setOps]         = useState<Operation[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [page, setPage]       = useState(0)
  const PAGE_SIZE = 25

  const load = useCallback(() => {
    setLoading(true)
    getOperations({ search, status, skip: page * PAGE_SIZE, limit: PAGE_SIZE })
      .then(({ items, total }) => { setOps(items); setTotal(total) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [search, status, page])

  useEffect(() => { load() }, [load])

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [search, status])

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700/60 bg-slate-900 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-semibold text-white">Operaciones</h1>
            <p className="text-xs text-slate-500">{total} operación{total !== 1 ? 'es' : ''} encontrada{total !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={load} className="text-slate-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-slate-800 transition">
            🔄 Actualizar
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por SO, BL, AWB, forwarder..."
            className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
            Cargando operaciones...
          </div>
        ) : ops.length === 0 ? (
          <EmptyState />
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-800/90 backdrop-blur-sm">
              <tr>
                {['SO / Referencias', 'Forwarder', 'Estado', 'ETD', 'ETA', 'Correos', 'Docs', 'Demoras'].map(
                  (h) => (
                    <th key={h} className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3 first:pl-6">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {ops.map((op) => (
                <tr
                  key={op.id}
                  onClick={() => onSelect(op.id)}
                  className={`cursor-pointer transition-colors hover:bg-slate-800/60 ${
                    selectedId === op.id ? 'bg-blue-600/10 border-l-2 border-blue-500' : ''
                  }`}
                >
                  <td className="px-4 py-3 pl-6">
                    <p className="font-mono font-semibold text-white text-sm">{op.so_number}</p>
                    <div className="flex gap-2 mt-0.5 flex-wrap">
                      {op.bl_number  && <span className="text-[10px] text-slate-400">BL: {op.bl_number}</span>}
                      {op.awb_number && <span className="text-[10px] text-slate-400">AWB: {op.awb_number}</span>}
                      {op.op_internal && <span className="text-[10px] text-slate-400">OP: {op.op_internal}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300 max-w-[120px] truncate">
                    {op.forwarder ?? <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={op.status as OperationStatus} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(op.etd_promised)}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(op.eta_promised)}</td>
                  <td className="px-4 py-3">
                    <span className="text-slate-300">{op.email_count}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={op.doc_count > 0 ? 'text-slate-300' : 'text-slate-600'}>{op.doc_count}</span>
                  </td>
                  <td className="px-4 py-3">
                    <DelayIndicator causes={op.delay_causes} hasDocs={op.has_pending_docs} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-700/60 text-sm">
          <span className="text-slate-500">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-300"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= total}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-300"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DelayIndicator({ causes, hasDocs }: { causes: string[]; hasDocs: boolean }) {
  const items = []
  if (hasDocs)        items.push({ icon: '📄', tip: 'Docs pendientes' })
  if (causes.length)  items.push({ icon: '⏱️', tip: `${causes.length} causa(s) de demora` })
  if (!items.length)  return <span className="text-slate-600 text-xs">—</span>

  return (
    <div className="flex gap-1">
      {items.map((i) => (
        <span key={i.icon} title={i.tip} className="cursor-help">{i.icon}</span>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-60 text-center px-6">
      <span className="text-5xl mb-4">📭</span>
      <p className="text-slate-400 font-medium">No hay operaciones registradas</p>
      <p className="text-slate-600 text-sm mt-1">
        Sincroniza Outlook desde el Dashboard para importar operaciones
      </p>
    </div>
  )
}
