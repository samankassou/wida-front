import { messages } from "./translations.ts";

export type Locale = "fr" | "en";
export const LOCALE_COOKIE = "wida-locale";
export const defaultLocale: Locale = "fr";
export const intlLocale = (locale: Locale) => locale === "fr" ? "fr-FR" : "en-GB";
export function parseLocale(value: unknown): Locale {
  return value === "en" || value === "fr" ? value : defaultLocale;
}

// Accept existing French copy as well as English message keys during migration.
const catalog = new Map(Object.values(messages).flatMap(message => [
  [message.en, message] as const, [message.fr, message] as const,
]));
export function translate(locale: Locale, message: string, values: Record<string, string | number> = {}): string {
  const text = catalog.get(message)?.[locale] ?? message;
  return text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}
