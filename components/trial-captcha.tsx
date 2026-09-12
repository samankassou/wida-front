"use client";
import { useLanguage } from "./language-provider";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { createApiClient, type ApiSession } from "@/lib/api";

type Turnstile = { render: (node: HTMLElement, options: { sitekey: string; action: string; language: string; callback: (token: string) => void; "error-callback": () => void }) => string; remove: (id: string) => void };

export default function TrialCaptcha({ siteKey, session }: { siteKey: string; session?: ApiSession }) {
  const { t, locale } = useLanguage();
  const node = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [status, setStatus] = useState("Vérification anti-robot avant l’import ou l’analyse.");
  const render = useCallback(() => {
    const turnstile = (window as Window & { turnstile?: Turnstile }).turnstile;
    if (!turnstile || !node.current || widget.current !== null) return;
    widget.current = turnstile.render(node.current, { sitekey: siteKey, action: "trial", language: locale,
      callback: token => { void createApiClient(session).verifyChallenge(token)
        .then(() => setStatus("Vérification réussie. Vous pouvez importer vos documents."))
        .catch(() => setStatus("Vérification échouée. Rechargez la page pour réessayer.")); },
      "error-callback": () => setStatus("Vérification indisponible. Rechargez la page pour réessayer.") });
  }, [siteKey, session, locale]);
  useEffect(() => {
    render();
    return () => {
      const turnstile = (window as Window & { turnstile?: Turnstile }).turnstile;
      if (widget.current !== null) turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [render]);
  return <div><p role="status">{t(status)}</p><div ref={node} /><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={render} onError={() => setStatus(t("Vérification indisponible. Rechargez la page pour réessayer."))} /></div>;
}
