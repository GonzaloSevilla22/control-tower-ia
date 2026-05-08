export type OperationStatus =
  | 'en_consolidacion'
  | 'aprobado_aduana'
  | 'intervencion_aduana'
  | 'en_transito'
  | 'detenida_aduana'
  | 'liberada_aduana'
  | 'entregada_warehouse'
  | 'enviada_costeo'
  | 'desconocido'

export type DelayCause =
  | 'falta_documentacion'
  | 'retraso_proveedor'
  | 'problema_produccion'
  | 'falta_stock'
  | 'demoras_aduaneras'
  | 'falta_booking'
  | 'retraso_pickup'
  | 'problemas_climaticos'
  | 'retraso_aerolinea'
  | 'error_interno'
  | 'espera_aprobacion'
  | 'problema_embalaje'
  | 'falta_cotizacion'

export interface Operation {
  id: number
  so_number: string
  delivery_numbers: string[]
  bl_number: string | null
  awb_number: string | null
  op_internal: string | null
  status: OperationStatus
  pickup_scheduled: string | null
  pickup_actual: string | null
  etd_promised: string | null
  etd_actual: string | null
  eta_promised: string | null
  eta_actual: string | null
  forwarder: string | null
  tracking_references: Record<string, string>
  has_pending_docs: boolean
  delay_causes: DelayCause[]
  last_email_date: string | null
  email_count: number
  doc_count: number
  created_at: string
  updated_at: string
}

export interface EmailRecord {
  id: number
  outlook_entry_id: string
  operation_id: number | null
  subject: string
  sender: string
  received_at: string
  body_preview: string
  has_attachments: boolean
  attachment_count: number
  found_so: string | null
  found_bl: string | null
  found_awb: string | null
  found_delivery: string[]
}

export interface Document {
  id: number
  operation_id: number
  email_id: number | null
  filename: string
  file_path: string
  doc_type: string | null
  file_size: number | null
  created_at: string
}

export interface DashboardStats {
  total_ops: number
  active: number
  delayed: number
  pending_docs: number
  in_transit: number
  at_customs: number
  delivered: number
  last_sync: string | null
}

export interface SyncResult {
  synced: number
  new_operations: number
  updated: number
  errors: number
  duration_seconds: number
}

export interface OutlookStatus {
  connected: boolean
  email: string | null
  display_name: string | null
  folders_count: number
}

export interface HealthCheck {
  status: string
  version: string
  outlook_available: boolean
  db_ok: boolean
}
