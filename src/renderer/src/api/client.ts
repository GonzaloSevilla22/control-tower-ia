import axios from 'axios'
import type {
  DashboardStats,
  EmailRecord,
  HealthCheck,
  Operation,
  OutlookStatus,
  SyncResult
} from '../types'

const BASE = 'http://127.0.0.1:8765'

const http = axios.create({
  baseURL: BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

// ── Health ────────────────────────────────────────────────
export const getHealth = (): Promise<HealthCheck> =>
  http.get('/api/health').then((r) => r.data)

// ── Outlook ───────────────────────────────────────────────
export const getOutlookStatus = (): Promise<OutlookStatus> =>
  http.get('/api/outlook/status').then((r) => r.data)

export const syncOutlook = (days = 30): Promise<SyncResult> =>
  http.post('/api/outlook/sync', { days }).then((r) => r.data)

// ── Stats ─────────────────────────────────────────────────
export const getStats = (): Promise<DashboardStats> =>
  http.get('/api/stats').then((r) => r.data)

// ── Operations ────────────────────────────────────────────
export interface OperationsParams {
  status?: string
  forwarder?: string
  search?: string
  skip?: number
  limit?: number
}

export const getOperations = (
  params: OperationsParams = {}
): Promise<{ items: Operation[]; total: number }> =>
  http.get('/api/operations', { params }).then((r) => r.data)

export const getOperation = (id: number): Promise<Operation> =>
  http.get(`/api/operations/${id}`).then((r) => r.data)

export const updateOperationStatus = (
  id: number,
  status: string
): Promise<Operation> =>
  http.patch(`/api/operations/${id}/status`, { status }).then((r) => r.data)

// ── Emails ────────────────────────────────────────────────
export const getEmails = (params: {
  operation_id?: number
  skip?: number
  limit?: number
}): Promise<{ items: EmailRecord[]; total: number }> =>
  http.get('/api/emails', { params }).then((r) => r.data)

// ── Documents ─────────────────────────────────────────────
export const getDocuments = (params: {
  operation_id?: number
}): Promise<{ items: import('../types').Document[] }> =>
  http.get('/api/documents', { params }).then((r) => r.data)

export const downloadAttachment = (
  emailEntryId: string,
  filename: string,
  operationId: number
): Promise<{ file_path: string }> =>
  http
    .post('/api/documents/download', { email_entry_id: emailEntryId, filename, operation_id: operationId })
    .then((r) => r.data)
