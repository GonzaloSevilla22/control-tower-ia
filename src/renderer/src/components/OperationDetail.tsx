import { useEffect, useState } from 'react'
import { getOperation, getEmails, getDocuments, updateOperationStatus } from '../api/client'
import type { Operation, EmailRecord, Document, OperationStatus } from '../types'
import StatusBadge from './StatusBadge'

const DELAY_LABELS: Record<string, string> = {
  falta_documentacion: 'Falta documentación',
  retraso_proveedor:   'Retraso del proveedor',
  problema_produccion: 'Problema de producción',
  falta_stock:         'Falta de stock',
  demoras_aduaneras:   'Demoras aduaneras',
  falta_booking:       'Falta de booking',
  retraso_pickup:      'Retraso de pickup',
  problemas_climaticos:'Problemas climáticos',
  retraso_aerolinea:   'Retraso aerolínea/naviera',
  error_interno:       'Error interno',
  espera_aprobacion:   'Espera de aprobación',
  problema_embalaje:   'Problema de embalaje',
  falta_cotizacion:    'Falta cotización'
}

interface Props {
  operationId: number
  onClose: () => void
}

export default function OperationDetail({ operationId, onClose }: Props) {
  const [op, setOp]         = useState<Operation | null>(null)
  const [emails, setEmails] = useState<EmailRecord[]>([])
  const [docs, setDocs]     = useState<Document[]>([])
  const [tab, setTab]       = useState<'info' | 'emails' | 'docs'>('info')
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    getOperation(operationId).then(setOp).catch(console.error)
    getEmails({ operation_id: operationId, limit: 50 }).then(({ items }) => setEmails(items)).catch(console.error)
    getDocuments({ operation_id: operationId }).then(({ items }) => setDocs(items)).catch(console.error)
  }, [operationId])

  const handleCopy = async () => {
    if (!op) return
    setCopying(true)
    const text = buildCopyText(op)
    await navigator.clipboard.writeText(text)
    setTimeout(() => setCopying(false), 1500)
  }

  const handleOpenDoc = (filePath: string) => {
    window.electronAPI?.openPath(filePath)
  }

  if (!op) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        Cargando operación...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700/60">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700/60 bg-slate-800/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Service Order</p>
            <h2 className="text-xl font-mono font-bold text-white">{op.so_number}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              <StatusBadge status={op.status as OperationStatus} />
              {op.has_pending_docs && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs">
                  📄 Docs pendientes
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg transition-colors"
            >
              {copying ? '✅ Copiado' : '📋 Copiar'}
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700/60 bg-slate-800/30">
        {(['info', 'emails', 'docs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'info' ? 'Información' : t === 'emails' ? `Correos (${emails.length})` : `Documentos (${docs.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {tab === 'info' && <InfoTab op={op} />}
        {tab === 'emails' && <EmailsTab emails={emails} />}
        {tab === 'docs' && <DocsTab docs={docs} onOpen={handleOpenDoc} />}
      </div>
    </div>
  )
}

// ── Info Tab ──────────────────────────────────────────────
function InfoTab({ op }: { op: Operation }) {
  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

  return (
    <div className="space-y-4">
      {/* References */}
      <Section title="Referencias">
        <Grid>
          <Field label="Service Order"     value={op.so_number} mono />
          <Field label="BL"                value={op.bl_number} mono />
          <Field label="AWB"               value={op.awb_number} mono />
          <Field label="OP Interno"        value={op.op_internal} mono />
          <Field label="Forwarder"         value={op.forwarder} />
          {op.delivery_numbers.length > 0 && (
            <Field label="Delivery Numbers" value={op.delivery_numbers.join(', ')} mono />
          )}
        </Grid>
      </Section>

      {/* Dates */}
      <Section title="Fechas Clave">
        <Grid>
          <Field label="Pickup Programado" value={fmtDate(op.pickup_scheduled)} />
          <Field label="Pickup Real"        value={fmtDate(op.pickup_actual)} />
          <Field label="ETD Prometido"      value={fmtDate(op.etd_promised)} />
          <Field label="ETD Real"           value={fmtDate(op.etd_actual)} />
          <Field label="ETA Prometido"      value={fmtDate(op.eta_promised)} />
          <Field label="ETA Real"           value={fmtDate(op.eta_actual)} />
        </Grid>
      </Section>

      {/* Delay causes */}
      {op.delay_causes.length > 0 && (
        <Section title="Causas de Demora">
          <div className="flex flex-wrap gap-2">
            {op.delay_causes.map((c) => (
              <span
                key={c}
                className="px-2.5 py-1 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-full text-xs"
              >
                ⏱ {DELAY_LABELS[c] ?? c}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Last update */}
      <Section title="Actividad">
        <Grid>
          <Field label="Último correo" value={op.last_email_date ? new Date(op.last_email_date).toLocaleString('es-AR') : '—'} />
          <Field label="Creada"        value={new Date(op.created_at).toLocaleDateString('es-AR')} />
          <Field label="Actualizada"   value={new Date(op.updated_at).toLocaleString('es-AR')} />
        </Grid>
      </Section>
    </div>
  )
}

// ── Emails Tab ────────────────────────────────────────────
function EmailsTab({ emails }: { emails: EmailRecord[] }) {
  if (!emails.length) return <Empty text="No hay correos vinculados" />

  return (
    <div className="space-y-2">
      {emails.map((e) => (
        <div key={e.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-slate-200 leading-tight flex-1">{e.subject}</p>
            {e.has_attachments && (
              <span className="text-xs text-slate-400 flex-shrink-0">📎 {e.attachment_count}</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">{e.sender}</p>
          <p className="text-xs text-slate-600 mt-0.5">
            {new Date(e.received_at).toLocaleString('es-AR')}
          </p>
          {e.body_preview && (
            <p className="text-xs text-slate-500 mt-2 line-clamp-2 italic">{e.body_preview}</p>
          )}
          <div className="flex gap-2 mt-2 flex-wrap">
            {e.found_so  && <Ref label="SO"  val={e.found_so} />}
            {e.found_bl  && <Ref label="BL"  val={e.found_bl} />}
            {e.found_awb && <Ref label="AWB" val={e.found_awb} />}
          </div>
        </div>
      ))}
    </div>
  )
}

function Ref({ label, val }: { label: string; val: string }) {
  return (
    <span className="text-[10px] font-mono bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
      {label}: {val}
    </span>
  )
}

// ── Docs Tab ──────────────────────────────────────────────
function DocsTab({ docs, onOpen }: { docs: Document[]; onOpen: (p: string) => void }) {
  if (!docs.length) return <Empty text="No hay documentos descargados" />

  const fmtSize = (bytes: number | null) => {
    if (!bytes) return ''
    return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
  }

  return (
    <div className="space-y-2">
      {docs.map((d) => (
        <div
          key={d.id}
          onClick={() => onOpen(d.file_path)}
          className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 cursor-pointer hover:bg-slate-800 transition-colors"
        >
          <span className="text-xl">{docIcon(d.filename)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 truncate">{d.filename}</p>
            <div className="flex gap-2 mt-0.5">
              {d.doc_type && (
                <span className="text-[10px] text-blue-400 capitalize">{d.doc_type.replace(/_/g, ' ')}</span>
              )}
              {d.file_size && <span className="text-[10px] text-slate-500">{fmtSize(d.file_size)}</span>}
            </div>
          </div>
          <span className="text-slate-500 text-xs">→</span>
        </div>
      ))}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-6 gap-y-3">{children}</div>
}

function Field({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm mt-0.5 ${mono ? 'font-mono' : ''} ${value ? 'text-slate-200' : 'text-slate-600'}`}>
        {value ?? '—'}
      </p>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-600 text-sm">
      <span className="text-3xl mb-3">📭</span>
      {text}
    </div>
  )
}

function docIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = { pdf: '📕', xlsx: '📗', xls: '📗', doc: '📘', docx: '📘', jpg: '🖼️', png: '🖼️', zip: '🗜️' }
  return map[ext ?? ''] ?? '📄'
}

function buildCopyText(op: Operation): string {
  const f = (v: string | null | undefined) => v ?? '—'
  const d = (v: string | null) => v ? new Date(v).toLocaleDateString('es-AR') : '—'

  return `OPERACIÓN LOGÍSTICA
━━━━━━━━━━━━━━━━━━━━━━━━━
Service Order: ${f(op.so_number)}
BL:            ${f(op.bl_number)}
AWB:           ${f(op.awb_number)}
OP Interno:    ${f(op.op_internal)}
Forwarder:     ${f(op.forwarder)}

FECHAS
Pickup Prog.:  ${d(op.pickup_scheduled)}
Pickup Real:   ${d(op.pickup_actual)}
ETD Prometido: ${d(op.etd_promised)}
ETD Real:      ${d(op.etd_actual)}
ETA Prometido: ${d(op.eta_promised)}
ETA Real:      ${d(op.eta_actual)}

ESTADO: ${op.status.replace(/_/g, ' ').toUpperCase()}
${op.delay_causes.length ? `DEMORAS: ${op.delay_causes.join(', ')}` : ''}
Generado por Control Tower IA`
}
