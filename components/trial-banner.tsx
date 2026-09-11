"use client";

import TrialCaptcha from "./trial-captcha";
import { useEffect, useState } from "react";
import { createApiClient, type ApiSession, type TrialBalance } from "@/lib/api";

export default function TrialBanner({ session, revision }: { session?: ApiSession; revision: string }) {
  const [balance, setBalance] = useState<TrialBalance | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => { void createApiClient(session).fetchTrial().then(value => {
      if (active) { setBalance(value); setError(""); }
    }).catch(() => { if (active) setError("Solde indisponible. Le quota sera vérifié avant chaque analyse."); }); };
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
  if (balance?.unrestricted) return <aside className="trial-banner" lang="fr" aria-label="Profil administrateur">
    <div><strong>Administrateur · Sans quota Wida</strong><p>Documents et analyses sans plafond applicatif. Originaux conservés sans expiration. Les limites du service Azure restent applicables.</p></div>
  </aside>;
  return <aside className="trial-banner" lang="fr" aria-label="Crédits de la bêta">
    <div><strong>{balance ? `${balance.pagesRemaining} page${balance.pagesRemaining > 1 ? "s" : ""} d’analyse disponible${balance.pagesRemaining > 1 ? "s" : ""}` : "Chargement du solde…"}</strong>
      <p>Crédit unique, sans renouvellement · 2 pages et 4 Mio par fichier · 10 documents · Originaux : 30 jours.</p>
      {balance?.publicPagesRemaining === 0 ? <p>Budget mensuel épuisé. Vous pouvez consulter, saisir et exporter vos factures.</p> : null}
      {error ? <p role="status">{error}</p> : null}
    </div>
    {balance?.captchaSiteKey ? <TrialCaptcha siteKey={balance.captchaSiteKey} session={session} /> : null}
    <button className="button" disabled={busy || balance?.creditRequested} onClick={request}>{balance?.creditRequested ? "Demande enregistrée" : busy ? "Envoi…" : "Demander plus de crédits"}</button>
  </aside>;
}
