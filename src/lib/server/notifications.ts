import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { NotificationStatus } from "@/generated/prisma/enums";
import type { Db } from "./db";
import { hasLocale, type LocalizedText } from "@/i18n/config";
import { mn } from "@/i18n/dictionaries/mn";
import { en } from "@/i18n/dictionaries/en";
import { site } from "@/content/site";
import { formatLongDate, minutesToTime } from "@/lib/booking/dates";
import { zonedParts } from "@/lib/booking/time";
import { format } from "@/lib/format";
import { getBookingRules } from "./settings";

/*
 * Notifications are written to the database first (inside the booking
 * transaction) and delivered afterwards, so a booking never depends on an
 * email provider being up. Each row records what actually happened:
 *
 *   SENT     the provider accepted the message (it may still bounce later)
 *   SKIPPED  not attempted: no provider is configured
 *   FAILED   the provider rejected it or was unreachable; `npm run notifications:retry`
 *
 * Only `SENT` is ever shown to a customer as "email sent".
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Lets the provider drop duplicates when a send is retried. */
  idempotencyKey: string;
}

export type SendResult = { ok: true; messageId?: string } | { ok: false; error: string };

export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<SendResult>;
}

const SEND_TIMEOUT_MS = 8_000;

/** Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email). */
export function createResendProvider(apiKey: string, from: string): EmailProvider {
  return {
    name: "resend",
    async send(message) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": message.idempotencyKey,
          },
          body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
        const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
        if (!response.ok) return { ok: false, error: `HTTP ${response.status}: ${body.message ?? body.name ?? "rejected"}` };
        return { ok: true, messageId: body.id };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "network error" };
      }
    },
  };
}

/** The configured provider, or null when email isn't set up (bookings still work). */
export function emailProviderFromEnv(env: NodeJS.ProcessEnv = process.env): EmailProvider | null {
  if (env.EMAIL_PROVIDER === "resend" && env.RESEND_API_KEY && env.EMAIL_FROM) {
    return createResendProvider(env.RESEND_API_KEY, env.EMAIL_FROM);
  }
  return null;
}

const MAX_ATTEMPTS = 5;

/**
 * Try to deliver one notification and record the outcome. Safe to call
 * again: SENT rows are left alone and attempts are capped.
 * `provider` defaults to the environment's configuration.
 */
export async function deliverNotification(
  db: Db,
  notificationId: string,
  provider: EmailProvider | null = emailProviderFromEnv(),
): Promise<NotificationStatus> {
  const notification = await db.notification.findUnique({
    where: { id: notificationId },
    include: { appointment: { include: { service: true, barber: true } } },
  });
  if (!notification) throw new Error(`Notification ${notificationId} not found`);
  if (notification.status === "SENT" || notification.attempts >= MAX_ATTEMPTS) return notification.status;

  if (notification.channel !== "EMAIL" || !provider) {
    await db.notification.update({
      where: { id: notificationId },
      data: { status: "SKIPPED", error: provider ? "channel_not_supported" : "provider_not_configured" },
    });
    return "SKIPPED";
  }

  const message = await renderBookingEmail(db, notification);
  const result = await provider.send(message);

  const updated = await db.notification.update({
    where: { id: notificationId },
    data: result.ok
      ? { status: "SENT", provider: provider.name, providerMessageId: result.messageId ?? null, error: null, sentAt: new Date(), attempts: { increment: 1 } }
      : { status: "FAILED", provider: provider.name, error: result.error.slice(0, 500), attempts: { increment: 1 } },
  });
  if (!result.ok) console.warn(`[notifications] ${notificationId} failed: ${result.error}`);
  return updated.status;
}

type NotificationWithAppointment = Prisma.NotificationGetPayload<{
  include: { appointment: { include: { service: true; barber: true } } };
}>;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function renderBookingEmail(db: Db, notification: NotificationWithAppointment): Promise<EmailMessage> {
  const { appointment } = notification;
  const locale = hasLocale(appointment.locale) ? appointment.locale : "mn";
  const dict = { mn, en }[locale];
  const t = dict.email.booking;
  const { timeZone } = await getBookingRules(db);
  const local = zonedParts(appointment.startsAt, timeZone);
  const text = (value: unknown) => (value as LocalizedText)[locale];

  const confirmed = appointment.status === "CONFIRMED";
  const subject = format(confirmed ? t.subjectConfirmed : t.subjectPending, {
    brand: site.brand.name,
    reference: appointment.reference,
  });
  const rows: [string, string][] = [
    [t.reference, appointment.reference],
    [t.service, text(appointment.service.name)],
    [t.barber, text(appointment.barber.name)],
    [t.date, formatLongDate(local.date, { weekdays: dict.weekdays, monthsLong: dict.calendar.monthsLong, dateLong: dict.calendar.dateLong })],
    [t.time, minutesToTime(local.minutes)],
    [t.address, `${site.contact.address[locale]}, ${site.contact.city[locale]}`],
  ];
  const paragraphs = [
    format(t.greeting, { name: appointment.customerName }),
    format(confirmed ? t.confirmed : t.pending, { brand: site.brand.name }),
    format(t.change, { phone: site.contact.phoneDisplay }),
    ...(site.isDemo ? [t.demo] : []),
  ];

  const textBody = [
    paragraphs[0],
    paragraphs[1],
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    ...paragraphs.slice(2),
    "",
    site.brand.name,
  ].join("\n");

  const html = `<!doctype html><html lang="${locale}"><body style="font-family:Helvetica,Arial,sans-serif;color:#1c1a17;line-height:1.5">
<p>${escapeHtml(paragraphs[0])}</p><p>${escapeHtml(paragraphs[1])}</p>
<table cellpadding="6" style="border-collapse:collapse">${rows
    .map(([label, value]) => `<tr><td style="color:#6b6359">${escapeHtml(label)}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`)
    .join("")}</table>
${paragraphs
  .slice(2)
  .map((p) => `<p>${escapeHtml(p)}</p>`)
  .join("")}<p>${escapeHtml(site.brand.name)}</p></body></html>`;

  return { to: notification.recipient, subject, text: textBody, html, idempotencyKey: `notification-${notification.id}` };
}
