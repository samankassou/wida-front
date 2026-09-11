"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CircleAlert, FileCheck2, LoaderCircle, LockKeyhole, ScanLine, ShieldCheck } from "lucide-react";
import { ApiError, fetchSession, logout, type ApiSession } from "@/lib/api";
import { AUTH_CHANGE_KEY, announceAuthChange, isLogoutEvent, loginErrorMessage, refreshActiveSession, type ActiveSession } from "@/lib/auth-state";
import { clearLiveDrafts } from "@/lib/storage";
import Workspace from "./workspace";

export default function AuthGate({ loginPage = false }: { loginPage?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const sessionRef = useRef<ActiveSession | null>(null);
  const revision = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<"expired" | "changed" | "logout" | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState(false);

  const invalidate = useCallback((nextReason: "expired" | "changed" | "logout") => {
    revision.current++;
    sessionRef.current?.controller.abort();
    sessionRef.current = null;
    setSession(null);
    setReason(nextReason);
    setLoading(false);
    setError(null);
  }, []);
  const onUnauthenticated = useCallback(() => invalidate("expired"), [invalidate]);
  const cancelSession = useCallback(() => {
    revision.current++;
    sessionRef.current?.controller.abort();
  }, []);

  const checkSession = useCallback(async (signal?: AbortSignal) => {
    const currentRevision = ++revision.current;
    try {
      const result = await fetchSession(signal);
      if (signal?.aborted || revision.current !== currentRevision) return;
      setGoogleConfigured(result.googleConfigured);
      setError(null);
      if (!result.authenticated || !result.user) {
        if (sessionRef.current?.user) invalidate("expired");
        setLoading(false);
        return;
      }
      const previous = sessionRef.current;
      const next = refreshActiveSession(previous, result);
      if (next !== previous) {
        sessionRef.current = next;
        setSession(next);
      }
      announceAuthChange(result.user.id);
      setReason(null);
      setLoading(false);
      if (loginPage) router.replace("/");
    } catch (cause) {
      if (signal?.aborted || revision.current !== currentRevision) return;
      if (!sessionRef.current) setError(cause instanceof Error ? cause.message : "La connexion à Wida est indisponible. Réessayez dans un instant.");
      setLoading(false);
    }
  }, [invalidate, loginPage, router]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => checkSession(controller.signal));
    const focus = () => { void checkSession(controller.signal); };
    const storage = (event: StorageEvent) => {
      if (event.key !== AUTH_CHANGE_KEY) return;
      // Other tabs may hold unsaved work that this tab could not warn about.
      // Hide their workspace immediately, retaining only owner-scoped recovery data.
      invalidate(isLogoutEvent(event.newValue) ? "logout" : "changed");
    };
    const pageshow = (event: PageTransitionEvent) => { if (event.persisted) { invalidate("changed"); void checkSession(controller.signal); } };
    window.addEventListener("focus", focus);
    window.addEventListener("storage", storage);
    window.addEventListener("pageshow", pageshow);
    return () => {
      controller.abort();
      cancelSession();
      window.removeEventListener("focus", focus);
      window.removeEventListener("storage", storage);
      window.removeEventListener("pageshow", pageshow);
    };
  }, [checkSession, invalidate, cancelSession]);

  const apiSession = useMemo<ApiSession | undefined>(() => session ? { csrfToken: session.csrfToken, signal: session.controller.signal, onUnauthenticated } : undefined, [session, onUnauthenticated]);

  const signOut = useCallback(async () => {
    if (!apiSession || !session?.user) return;
    try { await logout(apiSession); }
    catch (cause) { if (!(cause instanceof ApiError && cause.status === 401)) throw cause; }
    clearLiveDrafts(session.user.id);
    announceAuthChange(null, true);
    invalidate("logout");
    router.replace("/");
  }, [apiSession, session, invalidate, router]);

  if (session?.user && !loginPage) return <Workspace key={session.user.id} mode="live" user={session.user} apiSession={apiSession} onLogout={signOut} />;

  const message = error || loginErrorMessage(params.get("error"));
  const returnUrl = loginPage ? "/" : `/${params.size ? `?${params.toString()}` : ""}`;
  return <main className="workspace auth-page" lang="fr">
    <section className="auth-story" aria-label="Wida">
      <div className="brand"><span className="brand-mark"><ScanLine size={23} /></span>wida<span className="brand-dot">.</span></div>
      <div className="auth-story-copy"><span className="eyebrow">VOS DOCUMENTS, SIMPLEMENT</span><h1>Moins de saisie.<br />{" "}Plus de clarté</h1><p>Rassemblez vos factures, vérifiez les informations extraites et retrouvez vos documents au même endroit.</p><div className="auth-benefit"><FileCheck2 size={21} /><span>De l’original à la facture vérifiée.</span></div></div>
      <span className="auth-story-footer">Un peu moins de paperasse, chaque jour.</span>
    </section>
    <section className="auth-form-section" aria-labelledby="login-title">
      <div className="auth-card">
        <span className="auth-pilot"><span />BÊTA PUBLIQUE</span>
        <h2 id="login-title">{reason === "expired" ? "Reprenez votre travail." : reason === "logout" ? "À bientôt." : "Bienvenue dans Wida."}</h2>
        <p className="auth-description">{reason === "expired" ? "Votre session a expiré. Reconnectez-vous avec le même compte pour retrouver les brouillons conservés dans cet onglet." : reason === "logout" ? "Vous êtes déconnecté. Vos documents enregistrés vous attendent dans votre espace." : reason === "changed" ? "La connexion a changé dans un autre onglet. Vérifiez votre compte avant de continuer." : "4 pages d’analyse offertes — sans carte bancaire. Connectez-vous avec Google pour essayer vos propres factures."}</p>
        {message ? <div className="auth-message" role="alert"><CircleAlert size={18} /><p>{message}</p></div> : null}
        {loading || (session?.user && loginPage) ? <div className="auth-loading" role="status"><LoaderCircle className="spin" size={20} />Vérification de votre session…</div> : <>
          {googleConfigured ? <a className="button auth-google" href={`/api/wida/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`}><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.9-1.75 2.99-4.33 2.99-7.36Z" /><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.42l-3.23-2.5c-.9.6-2.05.97-3.39.97-2.61 0-4.82-1.76-5.61-4.13H3.05v2.6A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.39 13.92a6 6 0 0 1 0-3.84v-2.6H3.05a10 10 0 0 0 0 9.04l3.34-2.6Z" /><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.48l3.34 2.6C7.18 7.71 9.39 5.95 12 5.95Z" /></svg>Continuer avec Google<ArrowRight size={17} /></a> : !error ? <div className="auth-message" role="status"><LockKeyhole size={19} /><p>La connexion Google est en cours de configuration. Revenez bientôt ou découvrez la démo.</p></div> : null}
          {error || reason === "changed" || !googleConfigured ? <button className="button button-ghost auth-retry" onClick={() => { setLoading(true); void checkSession(); }}>Vérifier à nouveau</button> : null}
        </>}
        <a className="button auth-retry" href="/demo">Découvrir la démo sans connexion</a>
        <p className="auth-description">2 pages et 4 Mio maximum par fichier. 10 documents par compte. Originaux conservés 30 jours ; factures et historique conservés dans votre espace. Les crédits ne se renouvellent pas automatiquement.</p>
        <div className="auth-privacy"><ShieldCheck size={18} /><p>Votre espace est personnel. Google est utilisé uniquement pour vous connecter.</p></div>
      </div>
    </section>
  </main>;
}
