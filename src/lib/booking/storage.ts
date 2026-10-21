import { emptyDraft, type BookingDraft } from "./types";

/*
 * The booking draft lives in sessionStorage so switching language (which
 * re-renders the route under a new locale) or refreshing the page doesn't
 * discard the visitor's progress. Storage can be unavailable (private mode,
 * blocked site data), so every access is guarded and failure is silent.
 */

const KEY = "studio08.booking.v1";

export type BookingStep = "service" | "barber" | "time" | "details" | "review";

export interface StoredBooking {
  step: BookingStep;
  draft: BookingDraft;
  confirmation: { reference: string; assignedBarberId: string } | null;
}

export function loadBooking(): StoredBooking | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredBooking>;
    if (!parsed || typeof parsed !== "object" || !parsed.draft) return null;
    return {
      step: parsed.step ?? "service",
      draft: { ...emptyDraft, ...parsed.draft, customer: { ...emptyDraft.customer, ...parsed.draft.customer } },
      confirmation: parsed.confirmation ?? null,
    };
  } catch {
    return null;
  }
}

export function saveBooking(state: StoredBooking): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: the flow still works, it just won't survive reloads.
  }
}

export function clearBooking(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}
