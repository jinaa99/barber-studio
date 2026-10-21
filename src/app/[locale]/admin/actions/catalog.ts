"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { localizedPath } from "@/i18n/config";
import { mediaRecords } from "@/content/media";
import { catalogTag } from "@/lib/data";
import { routes } from "@/lib/navigation";
import { checkbox, failure, lines, parseForm, success, text, texts, type FormState } from "@/lib/admin/forms";
import { barberSchema, categorySchema, serviceSchema, timeOffSchema, validateBlocks } from "@/lib/admin/schemas";
import { db } from "@/lib/server/db";
import {
  addTimeOff,
  deleteCategory,
  deleteTimeOff,
  replaceWorkingHours,
  saveBarber,
  saveCategory,
  saveService,
  setServiceActive,
  type CatalogError,
} from "@/lib/server/catalog";
import { localeFrom, permitted } from "./shared";

/*
 * Services, categories, barbers, hours and time off (`catalog.manage`).
 * Every change refreshes the public catalogue cache.
 */

type Mode = "create" | "update";

function catalogFailure(error: CatalogError): FormState {
  switch (error) {
    case "taken":
      return failure("invalid", { id: "taken" });
    case "in_use":
      return failure("inUse");
    case "invalid_image":
      return failure("invalid", { imageId: "invalid" });
    case "invalid_category":
      return failure("invalid", { categoryId: "invalid" });
    default:
      return failure("notFound");
  }
}

function localized(formData: FormData, name: string) {
  return { mn: text(formData, `${name}.mn`), en: text(formData, `${name}.en`) };
}

function localizedLines(formData: FormData, name: string) {
  return { mn: lines(text(formData, `${name}.mn`)), en: lines(text(formData, `${name}.en`)) };
}

function changed() {
  updateTag(catalogTag);
  refresh();
}

/* -------------------------------------------------------------- Categories */

export async function saveCategoryAction(mode: Mode, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("catalog.manage", formData);
  if (!user) return failure("forbidden");
  const parsed = parseForm(categorySchema, {
    id: text(formData, "id"),
    name: localized(formData, "name"),
    sortOrder: text(formData, "sortOrder") || "0",
  });
  if (!parsed.ok) return parsed.state;
  const result = await saveCategory(db, parsed.data, user.id, mode);
  if (!result.ok) return catalogFailure(result.error);
  changed();
  return success(mode === "create" ? "created" : "saved");
}

export async function deleteCategoryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("catalog.manage", formData);
  if (!user) return failure("forbidden");
  const result = await deleteCategory(db, text(formData, "id"), user.id);
  if (!result.ok) return catalogFailure(result.error);
  changed();
  return success("deleted");
}

/* ---------------------------------------------------------------- Services */

export async function saveServiceAction(mode: Mode, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("catalog.manage", formData);
  if (!user) return failure("forbidden");
  const parsed = parseForm(serviceSchema, {
    id: text(formData, "id"),
    categoryId: text(formData, "categoryId"),
    name: localized(formData, "name"),
    summary: localized(formData, "summary"),
    includes: localizedLines(formData, "includes"),
    durationMinutes: text(formData, "durationMinutes"),
    priceMnt: text(formData, "priceMnt"),
    featured: checkbox(formData, "featured"),
    active: checkbox(formData, "active"),
    sortOrder: text(formData, "sortOrder") || "0",
    barberIds: texts(formData, "barberIds"),
  });
  if (!parsed.ok) return parsed.state;
  const result = await saveService(db, parsed.data, user.id, mode);
  if (!result.ok) return catalogFailure(result.error);
  changed();
  if (mode === "create") {
    redirect(`${localizedPath(localeFrom(formData), `${routes.adminServices}/${parsed.data.id}`)}?created=1`);
  }
  return success("saved");
}

export async function setServiceActiveAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("catalog.manage", formData);
  if (!user) return failure("forbidden");
  const result = await setServiceActive(db, text(formData, "serviceId"), formData.get("active") === "true", user.id);
  if (!result.ok) return catalogFailure(result.error);
  changed();
  return success("saved");
}

/* ----------------------------------------------------------------- Barbers */

export async function saveBarberAction(mode: Mode, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("catalog.manage", formData);
  if (!user) return failure("forbidden");
  const parsed = parseForm(barberSchema, {
    id: text(formData, "id"),
    name: localized(formData, "name"),
    role: localized(formData, "role"),
    bio: localized(formData, "bio"),
    specialties: localizedLines(formData, "specialties"),
    yearsExperience: text(formData, "yearsExperience") || "0",
    imageId: text(formData, "imageId"),
    active: checkbox(formData, "active"),
    sortOrder: text(formData, "sortOrder") || "0",
    serviceIds: texts(formData, "serviceIds"),
  });
  if (!parsed.ok) return parsed.state;
  const result = await saveBarber(
    db,
    parsed.data,
    user.id,
    mode,
    mediaRecords.filter((m) => m.src).map((m) => m.id),
  );
  if (!result.ok) return catalogFailure(result.error);
  changed();
  if (mode === "create") {
    redirect(`${localizedPath(localeFrom(formData), `${routes.adminBarbers}/${parsed.data.id}`)}?created=1`);
  }
  return success("saved");
}

export async function saveHoursAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("catalog.manage", formData);
  if (!user) return failure("forbidden");
  const weekdays = texts(formData, "weekday");
  const starts = texts(formData, "start");
  const ends = texts(formData, "end");
  const rows = weekdays.map((weekday, i) => ({ weekday, start: starts[i] ?? "", end: ends[i] ?? "" }));
  const { blocks, errors } = validateBlocks(rows);
  if (errors.length > 0) {
    return failure("invalid", Object.fromEntries(errors.map((e) => [`block.${e.index}`, e.code === "order" ? "range" : e.code])));
  }
  const result = await replaceWorkingHours(db, text(formData, "barberId"), blocks, user.id);
  if (!result.ok) return catalogFailure(result.error);
  changed();
  return result.value.outside > 0 ? success("hoursOutside", { count: result.value.outside }) : success("saved");
}

export async function addTimeOffAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("catalog.manage", formData);
  if (!user) return failure("forbidden");
  const allDay = checkbox(formData, "allDay");
  const parsed = parseForm(timeOffSchema, {
    barberId: text(formData, "barberId"),
    startDate: text(formData, "startDate"),
    endDate: text(formData, "endDate") || text(formData, "startDate"),
    allDay,
    startTime: text(formData, "startTime"),
    endTime: text(formData, "endTime"),
    reason: text(formData, "reason"),
  });
  if (!parsed.ok) return parsed.state;
  const result = await addTimeOff(db, parsed.data, user.id);
  if (!result.ok) return catalogFailure(result.error);
  changed();
  return result.value.affected > 0 ? success("timeOffAffected", { count: result.value.affected }) : success("created");
}

export async function deleteTimeOffAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("catalog.manage", formData);
  if (!user) return failure("forbidden");
  const result = await deleteTimeOff(db, text(formData, "id"), user.id);
  if (!result.ok) return catalogFailure(result.error);
  changed();
  return success("deleted");
}
