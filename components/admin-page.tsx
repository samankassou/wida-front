"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, LogOut, Moon, ScanLine, ShieldCheck, Sun } from "lucide-react";
import type { ApiSession } from "@/lib/api";
import type { SessionUser } from "@/lib/types";
import { LanguageSelector, useLanguage } from "./language-provider";
import AdminSettings from "./admin-settings";
import "./admin-page.css";

export default function AdminPage({ user, session, onLogout }: { user: SessionUser; session?: ApiSession; onLogout: () => Promise<void> }) {
  const { t } = useLanguage();
  const [theme, setTheme] = useState("light");
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      try { if (localStorage.getItem("wida:theme:v1") === "dark") setTheme("dark"); } catch { /* Default appearance. */ }
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  return <div className={`workspace administration-page theme-${theme}`}>
    <a className="admin-skip" href="#admin-content">{t("Skip to content")}</a>
    <header className="admin-page-header">
      <Link className="brand" href="/workspace" aria-label={t("Back to documents")}><span className="brand-mark"><ScanLine size={23} /></span>wida<span className="brand-dot">.</span></Link>
      <div className="admin-page-actions"><LanguageSelector /><button className="icon-button" aria-label={theme === "light" ? t("Dark") : t("Light")} onClick={() => { const next = theme === "light" ? "dark" : "light"; setTheme(next); try { localStorage.setItem("wida:theme:v1", next); } catch { /* Applied for this visit. */ } }}>{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button><button className="button button-small" disabled={loggingOut} onClick={async () => { setLoggingOut(true); setError(""); try { await onLogout(); } catch { setError("Unable to sign out. Please try again."); setLoggingOut(false); } }}>{loggingOut ? <LoaderCircle className="spin" size={16} /> : <LogOut size={16} />}{t("Sign out")}</button></div>
    </header>
    <main id="admin-content" className="admin-page-content" tabIndex={-1}>
      <Link className="admin-back" href="/workspace"><ArrowLeft size={16} />{t("Back to documents")}</Link>
      <div className="admin-page-title"><div><span className="admin-eyebrow"><ShieldCheck size={15} />{t("Administrator account")}</span><h1>{t("Administration")}</h1><p>{t("Manage trial allowances and monitor application usage.")}</p></div><div className="admin-identity"><strong>{user.displayName || user.email}</strong><span>{user.email}</span></div></div>
      {error ? <p className="error-banner" role="alert">{t(error)}</p> : null}
      <AdminSettings session={session} />
    </main>
  </div>;
}
