import type { Metadata } from "next";
import { Suspense } from "react";
import AuthGate from "@/components/auth-gate";
import { LocalizedText } from "@/components/language-provider";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administration · Wida", robots: { index: false, follow: false } };

export default function Administration() {
  if (!process.env.WIDA_API_URL) return <main className="workspace"><section className="empty-state"><h1><LocalizedText message="Administration" /></h1><p><LocalizedText message="Administration is unavailable in demo mode." /></p><a className="button" href="/workspace"><LocalizedText message="Back to documents" /></a></section></main>;
  return <Suspense fallback={<div className="app-loading"><LocalizedText message="Vérification de votre session…" /></div>}><AuthGate administration /></Suspense>;
}
