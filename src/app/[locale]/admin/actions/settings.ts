"use server";

import { refresh, updateTag } from "next/cache";
import { contentTag, settingsTag } from "@/lib/data";
import { checkbox, failure, parseForm, success, text, texts, type FormState } from "@/lib/admin/forms";
import { editableTexts, profileFormSchema, profileFromForm, weekdayOrder, type TextOverrides } from "@/lib/admin/content";
import { bookingRulesSchema, createAccountSchema, resetPasswordSchema, updateAccountSchema } from "@/lib/admin/schemas";
import { galleryRecords } from "@/content/demo/gallery";
import { db } from "@/lib/server/db";
import { saveBookingRules } from "@/lib/server/settings";
import { saveSiteContent } from "@/lib/server/content";
import { createAccount, resetPassword, updateAccount, type StaffError } from "@/lib/server/staff";
import { permitted } from "./shared";

/*
 * Booking rules and website content (`settings.manage`) and staff accounts
 * (`staff.manage`). All ADMIN-only; each checks again here.
 */

export async function saveRulesAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("settings.manage", formData);
  if (!user) return failure("forbidden");
  const parsed = parseForm(bookingRulesSchema, {
    slotIntervalMinutes: text(formData, "slotIntervalMinutes"),
    bookingHorizonDays: text(formData, "bookingHorizonDays"),
    minLeadMinutes: text(formData, "minLeadMinutes"),
    bufferMinutes: text(formData, "bufferMinutes"),
    maxActiveBookingsPerPhone: text(formData, "maxActiveBookingsPerPhone"),
    autoConfirm: checkbox(formData, "autoConfirm"),
  });
  if (!parsed.ok) return parsed.state;
  await saveBookingRules(db, parsed.data, user.id);
  updateTag(settingsTag);
  refresh();
  return success("saved");
}

/* ----------------------------------------------------------------- Content */

export async function saveProfileAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("settings.manage", formData);
  if (!user) return failure("forbidden");
  const localized = (name: string) => ({ mn: text(formData, `${name}.mn`), en: text(formData, `${name}.en`) });
  const parsed = parseForm(profileFormSchema, {
    isDemo: checkbox(formData, "isDemo"),
    name: text(formData, "name"),
    wordmark: { primary: text(formData, "wordmark.primary"), secondary: text(formData, "wordmark.secondary") },
    contact: {
      address: localized("contact.address"),
      city: localized("contact.city"),
      directions: localized("contact.directions"),
      phoneDisplay: text(formData, "contact.phoneDisplay"),
      email: text(formData, "contact.email"),
      mapsUrl: text(formData, "contact.mapsUrl"),
    },
    hours: weekdayOrder.map((day, i) => ({
      day,
      closed: checkbox(formData, `hours.${i}.closed`),
      open: text(formData, `hours.${i}.open`),
      close: text(formData, `hours.${i}.close`),
    })),
    socials: [0, 1, 2, 3].map((i) => ({
      label: text(formData, `socials.${i}.label`),
      handle: text(formData, `socials.${i}.handle`),
      href: text(formData, `socials.${i}.href`),
    })),
  });
  if (!parsed.ok) return parsed.state;
  await saveSiteContent(db, "profile", profileFromForm(parsed.data), user.id);
  updateTag(contentTag);
  refresh();
  return success("saved");
}

export async function saveTextsAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("settings.manage", formData);
  if (!user) return failure("forbidden");
  const overrides: TextOverrides = {};
  const fields: Record<string, "tooLong"> = {};
  for (const { key, max } of editableTexts) {
    const value = { mn: text(formData, `${key}.mn`).trim(), en: text(formData, `${key}.en`).trim() };
    for (const lang of ["mn", "en"] as const) if (value[lang].length > max) fields[`${key}.${lang}`] = "tooLong";
    if (value.mn || value.en) overrides[key] = value;
  }
  if (Object.keys(fields).length > 0) return failure("invalid", fields);
  await saveSiteContent(db, "texts", overrides, user.id);
  updateTag(contentTag);
  refresh();
  return success("saved");
}

export async function saveGalleryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("settings.manage", formData);
  if (!user) return failure("forbidden");
  const known = new Set(galleryRecords.map((g) => g.id));
  const hidden = texts(formData, "hidden").filter((id) => known.has(id));
  const order = galleryRecords
    .map((g, index) => ({ id: g.id, position: Number(text(formData, `position.${g.id}`)) || index + 1, index }))
    .sort((a, b) => a.position - b.position || a.index - b.index)
    .map((g) => g.id);
  await saveSiteContent(db, "gallery", { order, hidden }, user.id);
  updateTag(contentTag);
  refresh();
  return success("saved");
}

/* ------------------------------------------------------------------- Staff */

function staffFailure(error: StaffError): FormState {
  switch (error) {
    case "taken":
      return failure("invalid", { email: "taken" });
    case "barber_required":
      return failure("invalid", { barberId: "required" });
    case "barber_taken":
      return failure("invalid", { barberId: "taken" });
    case "self_change":
      return failure("selfChange");
    case "last_admin":
      return failure("lastAdmin");
    default:
      return failure("notFound");
  }
}

export async function createAccountAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("staff.manage", formData);
  if (!user) return failure("forbidden");
  const parsed = parseForm(createAccountSchema, {
    name: text(formData, "name"),
    email: text(formData, "email"),
    role: text(formData, "role"),
    password: text(formData, "password"),
    barberId: text(formData, "barberId"),
  });
  if (!parsed.ok) return parsed.state;
  const result = await createAccount(db, parsed.data, user.id);
  if (!result.ok) return staffFailure(result.error);
  refresh();
  return success("created");
}

export async function updateAccountAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("staff.manage", formData);
  if (!user) return failure("forbidden");
  const parsed = parseForm(updateAccountSchema, {
    userId: text(formData, "userId"),
    role: text(formData, "role"),
    active: checkbox(formData, "active"),
    barberId: text(formData, "barberId"),
  });
  if (!parsed.ok) return parsed.state;
  const result = await updateAccount(db, parsed.data, user.id);
  if (!result.ok) return staffFailure(result.error);
  refresh();
  return success("saved");
}

export async function resetPasswordAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("staff.manage", formData);
  if (!user) return failure("forbidden");
  const parsed = parseForm(resetPasswordSchema, { userId: text(formData, "userId"), password: text(formData, "password") });
  if (!parsed.ok) return parsed.state;
  const result = await resetPassword(db, parsed.data, user.id);
  if (!result.ok) return staffFailure(result.error);
  refresh();
  return success("saved");
}
