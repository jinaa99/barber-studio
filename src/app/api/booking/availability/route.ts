import type { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { getAvailability } from "@/lib/server/booking";
import { clientAddress, rateLimit } from "@/lib/server/rate-limit";

/** GET /api/booking/availability?service=…&barber=…&date=YYYY-MM-DD — free start times. Never cached. */
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (!rateLimit(`availability:${clientAddress(request.headers)}`, 120, 60_000)) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers });
  }

  const params = request.nextUrl.searchParams;
  try {
    const slots = await getAvailability(db, {
      date: params.get("date") ?? "",
      serviceId: params.get("service") ?? "",
      barberId: params.get("barber") ?? "",
    });
    if (!slots) return Response.json({ error: "invalid" }, { status: 400, headers });
    return Response.json({ slots }, { headers });
  } catch (error) {
    console.error("[booking] availability failed", error);
    return Response.json({ error: "unknown" }, { status: 500, headers });
  }
}
