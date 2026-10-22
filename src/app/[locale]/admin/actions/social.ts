"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { localizedPath } from "@/i18n/config";
import { routes } from "@/lib/navigation";
import { failure, success, text, type FormState } from "@/lib/admin/forms";
import { isSocialProvider } from "@/lib/social/meta";
import { db } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";
import { beginConnection, checkConnection, choosePage, disconnect, metaApi, socialConfig } from "@/lib/server/social";
import { localeFrom, permitted } from "./shared";

/*
 * Facebook Page and Instagram connections (`social.manage`, ADMIN only). Each
 * action checks the permission itself. Starting a connection redirects the
 * browser to Meta; the result comes back through
 * /api/social/[provider]/callback, never through these actions.
 */

const limited = (): FormState => ({ status: "error", message: "rateLimited", detail: { seconds: 600 }, at: Date.now() });

export async function startConnectionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("social.manage", formData);
  if (!user) return failure("forbidden");
  const provider = text(formData, "provider");
  if (!isSocialProvider(provider)) return failure("invalid");
  if (!rateLimit(`social-connect:${user.id}`, 10, 10 * 60_000)) return limited();
  const started = await beginConnection(db, socialConfig(), { provider, userId: user.id, locale: localeFrom(formData) });
  if (!started.ok) return failure("socialNotConfigured");
  redirect(started.url);
}

export async function choosePageAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("social.manage", formData);
  if (!user) return failure("forbidden");
  const pageId = text(formData, "pageId");
  if (!pageId) return failure("invalid", { pageId: "required" });
  const config = socialConfig();
  const result = await choosePage(db, metaApi(config), config, { pendingId: text(formData, "pendingId"), pageId, userId: user.id });
  redirect(`${localizedPath(localeFrom(formData), routes.adminSocial)}?result=${result}&provider=facebook`);
}

export async function checkConnectionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("social.manage", formData);
  if (!user) return failure("forbidden");
  const provider = text(formData, "provider");
  if (!isSocialProvider(provider)) return failure("invalid");
  if (!rateLimit(`social-check:${user.id}`, 20, 10 * 60_000)) return limited();
  const config = socialConfig();
  const result = await checkConnection(db, metaApi(config), config, provider);
  refresh();
  if (result === "ok") return success("socialChecked");
  if (result === "unavailable") return failure("providerUnavailable");
  return failure("socialNeedsReconnect");
}

export async function disconnectAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("social.manage", formData);
  if (!user) return failure("forbidden");
  const provider = text(formData, "provider");
  if (!isSocialProvider(provider)) return failure("invalid");
  const removed = await disconnect(db, provider, user.id);
  refresh();
  return removed ? success("disconnected") : failure("notFound");
}
