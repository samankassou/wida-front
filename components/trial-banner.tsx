"use client";

import { createPortal } from "react-dom";
import TrialCaptcha from "./trial-captcha";
import { useEffect, useState } from "react";
import { createApiClient, type ApiSession, type TrialBalance } from "@/lib/api";

export default function TrialBanner({ session, revision }: { session?: ApiSession; revision: string }) {
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
  if (balance?.unrestricted) return <aside className="sidebar-quota" lang="fr" aria-label="Quota administrateur"><div className="quota-heading"><span>Pages d’analyse</span><strong>Sans limite</strong></div><p>Compte administrateur</p></aside>;
  const used = balance ? Math.max(0, balance.pagesGranted - balance.pagesRemaining) : 0;
  const total = balance ? Math.max(0, balance.pagesGranted) : 0;
  const percent = total > 0 ? Math.min(100, used / total * 100) : 0;
  const number = new Intl.NumberFormat("fr-FR");
  return <>
    <aside className="sidebar-quota" lang="fr" aria-label="Quota de pages d’analyse">
      <div className="quota-heading"><span>Pages utilisées</span><strong>{balance ? `${number.format(used)} / ${number.format(total)}` : error ? "Indisponible" : "Chargement…"}</strong></div>
      {balance ? <><div className={`quota-track ${balance.pagesRemaining <= 0 ? "quota-exhausted" : ""}`} role="progressbar" aria-label="Pages d’analyse utilisées" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={Math.min(used, total)} aria-valuetext={`${used} pages utilisées sur ${total} accordées`}><span style={{ width: `${percent}%` }} /></div><p>{number.format(balance.pagesRemaining)} page{balance.pagesRemaining > 1 ? "s" : ""} restante{balance.pagesRemaining > 1 ? "s" : ""}</p></> : null}
      {error ? <p className="quota-error" role="status">{error}</p> : null}
      {balance?.publicPagesRemaining === 0 ? <p className="quota-error">Les analyses sont suspendues pour ce mois-ci. Vous pouvez toujours consulter, compléter et exporter vos factures.</p> : null}
      <details className="quota-details"><summary>Détails et crédits</summary><p>Crédit unique, sans renouvellement. 2 pages et 4 Mio par fichier. {balance?.maximumDocuments ?? 10} documents. Originaux conservés {balance?.originalRetentionDays ?? 30} jours.</p><button className="button button-small" disabled={!balance || busy || balance.creditRequested} onClick={request}>{balance?.creditRequested ? "Demande enregistrée" : busy ? "Envoi…" : "Demander des crédits"}</button></details>
    </aside>
    {balance?.captchaSiteKey && verificationTarget ? createPortal(<div className="quota-verification"><TrialCaptcha siteKey={balance.captchaSiteKey} session={session} /></div>, verificationTarget) : null}
  </>;
}
