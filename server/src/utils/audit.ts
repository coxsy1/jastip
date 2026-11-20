import { db } from "../db/client.js";

export interface AuditLogInput {
  actorId?: string | null;
  entity: string;
  entityId: string;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/**
 * Records an audit log entry in the database.
 * Silently catches errors if DB write fails so non-critical audit failures don't block operations.
 */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        before: input.before ? (input.before as any) : undefined,
        after: input.after ? (input.after as any) : undefined,
      },
    });
  } catch (err) {
    console.error(`[AUDIT_LOG_ERROR] Gagal mencatat audit log (${input.action} on ${input.entity}/${input.entityId}):`, err);
  }
}
