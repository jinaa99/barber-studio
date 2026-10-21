import type { CustomerDetails } from "./types";

/*
 * Customer-detail rules shared by the booking form (instant feedback) and the
 * server (the authority). Messages are resolved by the caller from the dictionary.
 */

export const LIMITS = { name: 80, email: 254, notes: 500 } as const;

export type CustomerField = "name" | "phone" | "email" | "notes";

/** Digits only. A leading "+" or spaces, dashes and brackets are dropped. */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s()+.-]/g, "");
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Fields that fail validation. Empty when the details are acceptable. */
export function invalidCustomerFields(customer: CustomerDetails): CustomerField[] {
  const invalid: CustomerField[] = [];
  const name = customer.name.trim();
  if (name.length < 2 || name.length > LIMITS.name) invalid.push("name");
  if (!/^\d{8,15}$/.test(normalizePhone(customer.phone))) invalid.push("phone");
  const email = customer.email.trim();
  if (email && (email.length > LIMITS.email || !EMAIL.test(email))) invalid.push("email");
  if (customer.notes.length > LIMITS.notes) invalid.push("notes");
  return invalid;
}
