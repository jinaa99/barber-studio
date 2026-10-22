import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "./db";

/** Actions recorded in the audit log. Keep names stable: they are queried later. */
export type AuditAction =
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "appointment.status_changed"
  | "appointment.created"
  | "appointment.rescheduled"
  | "service.created"
  | "service.updated"
  | "service.activated"
  | "service.deactivated"
  | "category.created"
  | "category.updated"
  | "category.deleted"
  | "barber.created"
  | "barber.updated"
  | "barber.activated"
  | "barber.deactivated"
  | "barber.hours_updated"
  | "time_off.created"
  | "time_off.deleted"
  | "settings.updated"
  | "content.profile_updated"
  | "content.texts_updated"
  | "content.gallery_updated"
  | "media.saved"
  | "media.uploaded"
  | "media.updated"
  | "media.published"
  | "media.unpublished"
  | "media.deleted"
  | "media.replaced"
  | "media.placed"
  | "media.unplaced"
  | "social.connected"
  | "social.disconnected"
  | "social.needs_reconnect"
  | "user.created"
  | "user.updated"
  | "user.password_reset";

export const auditActions: AuditAction[] = [
  "auth.login",
  "auth.login_failed",
  "auth.logout",
  "appointment.status_changed",
  "appointment.created",
  "appointment.rescheduled",
  "service.created",
  "service.updated",
  "service.activated",
  "service.deactivated",
  "category.created",
  "category.updated",
  "category.deleted",
  "barber.created",
  "barber.updated",
  "barber.activated",
  "barber.deactivated",
  "barber.hours_updated",
  "time_off.created",
  "time_off.deleted",
  "settings.updated",
  "content.profile_updated",
  "content.texts_updated",
  "content.gallery_updated",
  "media.saved",
  "media.uploaded",
  "media.updated",
  "media.published",
  "media.unpublished",
  "media.deleted",
  "media.replaced",
  "media.placed",
  "media.unplaced",
  "social.connected",
  "social.disconnected",
  "social.needs_reconnect",
  "user.created",
  "user.updated",
  "user.password_reset",
];

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

/** Groups for filtering the activity log. */
export const auditGroups = {
  auth: ["auth."],
  appointment: ["appointment."],
  catalog: ["service.", "category.", "barber.", "time_off."],
  settings: ["settings.", "content."],
  media: ["media."],
  social: ["social."],
  user: ["user."],
} as const;

export type AuditGroup = keyof typeof auditGroups;

export async function listAuditLog(db: Db, options: { group?: AuditGroup; page: number; pageSize?: number }) {
  const pageSize = options.pageSize ?? 50;
  const page = Math.max(1, options.page);
  const where: Prisma.AuditLogWhereInput = options.group
    ? { OR: auditGroups[options.group].map((prefix) => ({ action: { startsWith: prefix } })) }
    : {};
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true, actor: { select: { name: true } } },
    }),
  ]);
  return { total, rows, page, pageSize };
}
