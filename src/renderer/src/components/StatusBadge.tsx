import type { OperationStatus } from '../types'

const STATUS_CONFIG: Record<
  OperationStatus,
  { label: string; color: string; dot: string }
> = {
  en_consolidacion:    { label: 'En Consolidación',      color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', dot: 'bg-yellow-400' },
  aprobado_aduana:     { label: 'Aprobado Aduana',       color: 'bg-blue-500/20 text-blue-300 border-blue-500/40',       dot: 'bg-blue-400' },
  intervencion_aduana: { label: 'Intervención Aduana',   color: 'bg-orange-500/20 text-orange-300 border-orange-500/40', dot: 'bg-orange-400' },
  en_transito:         { label: 'En Tránsito',           color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', dot: 'bg-indigo-400' },
  detenida_aduana:     { label: 'Detenida en Aduana',    color: 'bg-red-500/20 text-red-300 border-red-500/40',          dot: 'bg-red-400' },
  liberada_aduana:     { label: 'Liberada de Aduana',    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', dot: 'bg-emerald-400' },
  entregada_warehouse: { label: 'Entregada Warehouse',   color: 'bg-teal-500/20 text-teal-300 border-teal-500/40',       dot: 'bg-teal-400' },
  enviada_costeo:      { label: 'Enviada a Costeo',      color: 'bg-purple-500/20 text-purple-300 border-purple-500/40', dot: 'bg-purple-400' },
  desconocido:         { label: 'Desconocido',           color: 'bg-slate-500/20 text-slate-400 border-slate-500/40',    dot: 'bg-slate-400' }
}

interface Props {
  status: OperationStatus
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.desconocido
  const textSize = size === 'sm' ? 'text-xs' : 'text-xs'
  const padding  = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${cfg.color} ${textSize} ${padding}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}
