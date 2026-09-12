"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Globe } from "lucide-react";
import { defaultLocale, intlLocale, LOCALE_COOKIE, parseLocale, translate, type Locale } from "@/lib/i18n";

const LanguageContext = createContext({
  locale: defaultLocale,
  setLocale: (() => {}) as (locale: Locale) => void,
});

export function LanguageProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, updateLocale] = useState(initialLocale);
  const setLocale = useCallback((value: Locale) => {
    const next = parseLocale(value);
    updateLocale(next);
    document.documentElement.lang = next;
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }, []);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const { locale, setLocale } = useContext(LanguageContext);
  const t = useCallback((message: string, values?: Record<string, string | number>) => translate(locale, message, values), [locale]);
  return { locale, setLocale, t, formatLocale: intlLocale(locale) };
}

export function LanguageSelector() {
  const { locale, setLocale, t } = useLanguage();
  return <label className="language-selector"><Globe size={16} aria-hidden="true" /><span className="visually-hidden">{t("Language")}</span><select aria-label={t("Language")} value={locale} onChange={event => setLocale(parseLocale(event.target.value))}><option value="fr" lang="fr">Français</option><option value="en" lang="en">English</option></select></label>;
}

export function LocalizedText({ message }: { message: string }) {
  const { t } = useLanguage();
  return t(message);
}
