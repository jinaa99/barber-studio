"use client";

import { useSyncExternalStore } from "react";
import { emptyDraft } from "@/lib/booking/types";
import { clearBooking, loadBooking, saveBooking, type StoredBooking } from "@/lib/booking/storage";

/*
 * A tiny external store over sessionStorage. Using useSyncExternalStore means
 * the server (and the static prerender) always sees `null` and renders the
 * loading shell, while the browser reads the saved draft synchronously on
 * hydration. Preserved route instances (e.g. /mn/booking and /en/booking kept
 * alive by Activity) share the same state.
 */

const initialState: StoredBooking = { step: "service", draft: emptyDraft, attemptKey: null, confirmation: null };

let cache: StoredBooking | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): StoredBooking {
  if (!cache) cache = loadBooking() ?? initialState;
  return cache;
}

function getServerSnapshot(): null {
  return null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((l) => l());
}

export function updateBooking(updater: (state: StoredBooking) => StoredBooking) {
  cache = updater(getSnapshot());
  saveBooking(cache);
  emit();
}

export function resetBooking() {
  cache = initialState;
  clearBooking();
  emit();
}

/** `null` until the component is running in the browser. */
export function useBookingStore(): StoredBooking | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
