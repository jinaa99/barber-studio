import type { NextRequest } from "next/server";
import type { BookingResult } from "@/lib/booking/types";
import { db } from "@/lib/server/db";
import { createBooking } from "@/lib/server/booking";
import { isSameOrigin } from "@/lib/server/origin";
import { clientAddress, rateLimit } from "@/lib/server/rate-limit";

const MAX_BODY_BYTES = 8 * 1024;

const statusFor: Record<Exclude<BookingResult, { ok: true }>["error"], number> = {
  invalid: 422,
  slot_taken: 409,
  limit_reached: 409,
  rate_limited: 429,
  unknown: 500,
};

function reply(result: BookingResult) {
  return Response.json(result, {
    status: result.ok ? 201 : statusFor[result.error],
    headers: { "Cache-Control": "no-store" },
  });
}

/** POST /api/booking — validate, re-check availability and create the appointment. */
export async function POST(request: NextRequest) {
  // Same-origin JSON only: blocks cross-site form posts.
  if (!isSameOrigin(request.headers, { allowMissing: true })) {
    return Response.json({ ok: false, error: "invalid" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return reply({ ok: false, error: "invalid" });
  }
  if (!rateLimit(`booking:${clientAddress(request.headers)}`, 10, 10 * 60_000)) {
    return reply({ ok: false, error: "rate_limited" });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return reply({ ok: false, error: "invalid" });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply({ ok: false, error: "invalid" });
  }

  try {
    return reply(await createBooking(db, body));
  } catch (error) {
    console.error("[booking] create failed", error);
    return reply({ ok: false, error: "unknown" });
  }
}
