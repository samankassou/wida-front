"use client";
import { useLanguage } from "./language-provider";

import { createPortal } from "react-dom";
import TrialCaptcha from "./trial-captcha";
import { useEffect, useState } from "react";
import { createApiClient, type ApiSession, type TrialBalance } from "@/lib/api";

export default function TrialBanner({ session, revision }: { session?: ApiSession; revision: string }) {
  const { t, formatLocale } = useLanguage();
  const [balance, setBalance] = useState<TrialBalance | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const verificationTarget = balance?.captchaSiteKey && typeof document !== "undefined" ? document.getElementById("quota-verification") : null;
  useEffect(() => {
    let active = true;
    const refresh = () => { void createApiClient(session).fetchTrial().then(value => {
      if (active) { setBalance(value); setError(""); }
    }).catch(() => { if (active) setError("Le nombre de pages restantes est temporairement indisponible."); }); };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [session, revision]);
  async function request() {
    setBusy(true);
    try {
      await createApiClient(session).requestCredits();
      setBalance(previous => previous ? { ...previous, creditRequested: true } : previous);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "La demande a échoué."); }
    finally { setBusy(false); }
  }
  if (balance?.unrestricted) return <aside className="sidebar-quota" aria-label={t("Quota administrateur")}><div className="quota-heading"><span>{t("Pages d’analyse")}</span><strong>{t("Sans limite")}</strong></div><p>{t("Compte administrateur")}</p></aside>;
  const used = balance ? Math.max(0, balance.pagesGranted - balance.pagesRemaining) : 0;
  const total = balance ? Math.max(0, balance.pagesGranted) : 0;
  const percent = total > 0 ? Math.min(100, used / total * 100) : 0;
  const number = new Intl.NumberFormat(formatLocale);
  return <>
    <aside className="sidebar-quota" aria-label={t("Quota de pages d’analyse")}>
      <div className="quota-heading"><span>{t("Pages utilisées")}</span><strong>{balance ? `${number.format(used)} / ${number.format(total)}` : error ? t("Indisponible") : t("Chargement…")}</strong></div>
      {balance ? <><div className={`quota-track ${balance.pagesRemaining <= 0 ? "quota-exhausted" : ""}`} role="progressbar" aria-label={t("Pages d’analyse utilisées")} aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={Math.min(used, total)} aria-valuetext={t("{used} pages used out of {total} granted", { used, total })}><span style={{ width: `${percent}%` }} /></div><p>{t(balance.pagesRemaining === 1 ? "{count} page remaining" : "{count} pages remaining", { count: number.format(balance.pagesRemaining) })}</p></> : null}
      {error ? <p className="quota-error" role="status">{t(error)}</p> : null}
      {balance?.publicPagesRemaining === 0 ? <p className="quota-error">{t("Les analyses sont suspendues pour ce mois-ci. Vous pouvez toujours consulter, compléter et exporter vos factures.")}</p> : null}
      <details className="quota-details"><summary>{t("Détails et crédits")}</summary><p>{t("One-time credits, no renewal. 2 pages and 4 MiB per file. {documents} documents. Originals kept for {days} days.", { documents: balance?.maximumDocuments ?? 10, days: balance?.originalRetentionDays ?? 30 })}</p><button className="button button-small" disabled={!balance || busy || balance.creditRequested} onClick={request}>{balance?.creditRequested ? t("Demande enregistrée") : busy ? t("Envoi…") : t("Demander des crédits")}</button></details>
    </aside>
    {balance?.captchaSiteKey && verificationTarget ? createPortal(<div className="quota-verification"><TrialCaptcha siteKey={balance.captchaSiteKey} session={session} /></div>, verificationTarget) : null}
  </>;
}
