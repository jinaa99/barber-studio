import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "./db";
import {
  resolveGallery,
  resolveProfile,
  resolveTexts,
  type GallerySettings,
  type StudioProfile,
  type TextOverrides,
} from "@/lib/admin/content";
import { audit } from "./audit";

/*
 * The `site_content` row: studio profile, copy overrides and gallery curation.
 * Reads always succeed (defaults fill anything missing); writes replace one
 * section at a time and are audited. Callers authorize (`settings.manage`)
 * and refresh the public cache (`updateTag(contentTag)`).
 */

export async function readSiteContent(db: Db): Promise<{ profile: StudioProfile; texts: TextOverrides; gallery: GallerySettings }> {
  const row = await db.siteContent.findUnique({ where: { id: "default" } });
  return { profile: resolveProfile(row?.profile), texts: resolveTexts(row?.texts), gallery: resolveGallery(row?.gallery) };
}

type Section = "profile" | "texts" | "gallery";
const actions = {
  profile: "content.profile_updated",
  texts: "content.texts_updated",
  gallery: "content.gallery_updated",
} as const;

export async function saveSiteContent(
  db: Db,
  section: Section,
  value: StudioProfile | TextOverrides | GallerySettings,
  actorId: string,
): Promise<void> {
  const json = value as unknown as Prisma.InputJsonValue;
  await db.$transaction(async (tx) => {
    await tx.siteContent.upsert({
      where: { id: "default" },
      create: { id: "default", [section]: json },
      update: { [section]: json },
    });
    await audit(tx, { actorId, action: actions[section], entityType: "SiteContent", entityId: "default" });
  });
}
