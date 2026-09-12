import type { Metadata } from "next";
import "./globals.css";
import { cookies } from "next/headers";
import { LanguageProvider } from "@/components/language-provider";
import { LOCALE_COOKIE, parseLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Wida — A little less paperwork",
  description: "Bring your documents together. Review extracted invoice details, keep your originals, and build a clear invoice library with Wida.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return <html lang={locale}><body><LanguageProvider initialLocale={locale}>{children}</LanguageProvider></body></html>;
}
