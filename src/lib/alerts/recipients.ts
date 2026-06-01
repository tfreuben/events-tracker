import type { TFEvent } from "@/types";

export type RecipientsByBU = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmails(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter((s) => EMAIL_RE.test(s));
}

export function parseBusinessUnits(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function resolveRecipients(
  event: TFEvent,
  recipientsByBU: RecipientsByBU
): string[] {
  const set = new Set<string>();

  for (const bu of parseBusinessUnits(event.business_unit)) {
    for (const email of parseEmails(recipientsByBU[bu])) {
      set.add(email.toLowerCase());
    }
  }

  for (const email of parseEmails(event.staff_emails)) {
    set.add(email.toLowerCase());
  }

  return Array.from(set);
}
