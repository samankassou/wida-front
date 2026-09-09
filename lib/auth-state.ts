import type { AuthSession } from "./types";

export type ActiveSession = AuthSession & { controller: AbortController };

export function refreshActiveSession(previous: ActiveSession | null, latest: AuthSession): ActiveSession {
  if (previous?.authenticated && latest.authenticated && previous.user && latest.user && previous.user.id === latest.user.id && !previous.controller.signal.aborted) {
    // Keep in-flight work and the current user's workspace when only the
    // antiforgery token changes (for example after its cookie is renewed).
    return previous.csrfToken === latest.csrfToken ? previous : { ...previous, csrfToken: latest.csrfToken };
  }
  previous?.controller.abort();
  return { ...latest, controller: new AbortController() };
}

// Only an opaque user id is stored here; cookies and CSRF tokens stay out of storage.
export const AUTH_CHANGE_KEY = "wida:auth-change:v1";

export function announceAuthChange(userId: string | null, loggedOut = false): void {
  try {
    const previous = JSON.parse(localStorage.getItem(AUTH_CHANGE_KEY) || "null");
    if (!loggedOut && previous?.userId === userId) return;
    localStorage.setItem(AUTH_CHANGE_KEY, JSON.stringify({ userId, loggedOut, nonce: crypto.randomUUID() }));
  } catch { /* Session checks on focus also detect changes when storage is unavailable. */ }
}

export function isLogoutEvent(value: string | null): boolean {
  try { return JSON.parse(value || "null")?.loggedOut === true; } catch { return false; }
}

export function loginErrorMessage(error: string | null): string | null {
  switch (error) {
    case "not_invited": return "Ce compte n’a pas encore accès au pilote. Utilisez l’adresse Google invitée ou contactez la personne qui vous a invité.";
    case "authentication_failed": return "La connexion Google n’a pas abouti. Réessayez pour ouvrir votre espace.";
    case "configuration": return "La connexion Google est en cours de configuration. Contactez la personne qui vous a invité.";
    default: return null;
  }
}
