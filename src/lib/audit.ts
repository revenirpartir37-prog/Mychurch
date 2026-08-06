import { db } from '@/lib/db'

/**
 * Create an audit log entry.
 * This is a fire-and-forget helper — callers should NOT await it in the hot path,
 * but may await when it's safe (e.g. after the main response work is done).
 */
export async function createAuditLog(params: {
  churchId: string
  userId: string
  action: string
  details?: string
  ipAddress?: string
}) {
  try {
    await db.auditLog.create({
      data: {
        churchId: params.churchId,
        userId: params.userId,
        action: params.action,
        details: params.details ?? null,
        ipAddress: params.ipAddress ?? null,
      },
    })
  } catch (error) {
    // Audit logs should never break the main flow
    console.error('Failed to write audit log:', error)
  }
}