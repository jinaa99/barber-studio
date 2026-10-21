import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "./db";

/** Actions recorded in the audit log. Keep names stable: they are queried later. */
export type AuditAction =
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "appointment.status_changed"
  | "service.activated"
  | "service.deactivated"
  | "user.created";

export async function audit(
  db: Db | Prisma.TransactionClient,
  entry: {
    actorId: string | null;
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata,
    },
  });
}
