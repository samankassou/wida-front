"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { createApiClient, type AdminMetrics, type AdminUser, type AdminUserPage, type ApiSession } from "@/lib/api";
import { useLanguage } from "./language-provider";
import "./admin-settings.css";

export default function AdminSettings({ session }: { session?: ApiSession }) {
  const { t } = useLanguage();
  const client = useMemo(() => createApiClient(session), [session]);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [result, setResult] = useState<AdminUserPage | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const [nextMetrics, nextUsers] = await Promise.all([client.fetchAdminMetrics(), client.fetchAdminUsers(search, page)]);
        if (active) { setMetrics(nextMetrics); setResult(nextUsers); }
      } catch (cause) { if (active) { setMetrics(null); setResult(null); setError(cause instanceof Error ? cause.message : "Unable to load administration."); } }
      finally { if (active) setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [client, search, page, revision]);
  return <section className="admin-settings" aria-label={t("Administrator settings")}>
    <div className="admin-toolbar"><p>{t("Manage trial allowances and monitor application usage.")}</p><button className="button button-small" disabled={loading} onClick={() => { setLoading(true); setRevision(x => x + 1); }}><RefreshCw size={15} />{t("Refresh status")}</button></div>
    {notice ? <p role="status">{t(notice)}</p> : null}
    {error ? <p className="error-banner" role="alert">{t(error)}</p> : null}
    {metrics ? <><h3>{t("Global usage")}</h3><dl className="admin-metrics">{([
      ["Users", metrics.users], ["Documents", metrics.documents], ["Invoices", metrics.invoices],
      ["Completed analyses", metrics.analysesCompleted], ["Failed analyses", metrics.analysesFailed],
      ["Active analyses", metrics.analysesActive], ["Credit requests", metrics.creditRequests],
    ] as const).map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}</dl>
    <p className="admin-budget">{t("Monthly analysis budget")} · {metrics.month} (UTC) : <strong>{metrics.monthlyPagesUsed} / {metrics.monthlyPagesLimit}</strong> {t("pages")}</p></> : null}
    <h3>{t("Users and trial limits")}</h3>
    <p>{t("The allowance is a lifetime total. Lowering it below usage leaves zero pages remaining. Administrators are unlimited.")}</p>
    <label className="admin-search">{t("Search users")}<input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); setLoading(true); }} placeholder={t("Name or email")} /></label>
    {loading ? <p role="status"><LoaderCircle className="spin" size={16} /> {t("Loading…")}</p> : result ? <>
      <div className="admin-users">{result.users.length ? result.users.map(user => <UserAllowance key={`${user.id}:${revision}`} user={user} client={client} onSaved={() => { setNotice("Trial allowance updated."); setLoading(true); setRevision(x => x + 1); }} />) : <p>{t("No users found.")}</p>}</div>
      <div className="admin-pagination"><span>{result.total} {t("users")} · {result.page} / {Math.max(1, Math.ceil(result.total / result.pageSize))}</span><button className="button button-small" disabled={result.page <= 1} onClick={() => { setPage(result.page - 1); setLoading(true); }}>{t("Previous")}</button><button className="button button-small" disabled={result.page * result.pageSize >= result.total} onClick={() => { setPage(result.page + 1); setLoading(true); }}>{t("Next")}</button></div>
    </> : null}
  </section>;
}

function UserAllowance({ user, client, onSaved }: { user: AdminUser; client: ReturnType<typeof createApiClient>; onSaved: () => void }) {
  const { t, formatLocale } = useLanguage();
  const [granted, setGranted] = useState(String(user.pagesGranted));
  const [resolve, setResolve] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const admin = user.role === "Admin";
  return <form className="admin-user" onSubmit={async event => {
    event.preventDefault();
    if (saving || admin) return;
    setSaving(true); setError("");
    try { await client.updateUserTrial(user.id, Number(granted), resolve); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save changes."); }
    finally { setSaving(false); }
  }}>
    <div className="admin-user-heading"><div><strong>{user.displayName || user.email}</strong><small>{user.email}</small></div><span className="badge">{admin ? t("Administrator account") : t("User")}</span></div>
    <p>{t("Joined")} {new Date(user.createdAt).toLocaleDateString(formatLocale)} · {admin ? t("Unlimited") : `${user.pagesUsed} ${t("pages used")} · ${Math.max(0, user.pagesGranted - user.pagesUsed)} ${t("pages remaining")}`}</p>
    {!admin ? <fieldset disabled={saving}><div className="admin-allowance"><label htmlFor={`allowance-${user.id}`}>{t("Total pages granted")}</label><input id={`allowance-${user.id}`} type="number" min="0" max="1000000" step="1" required value={granted} onChange={event => setGranted(event.target.value)} /><button className="button button-primary button-small" disabled={Number(granted) === user.pagesGranted && !resolve} type="submit">{saving ? t("Saving…") : t("Save")}</button></div>
      {user.creditRequestedAt ? <label className="admin-credit"><input type="checkbox" checked={resolve} onChange={event => setResolve(event.target.checked)} />{t("Mark credit request as handled")} · {new Date(user.creditRequestedAt).toLocaleDateString(formatLocale)}</label> : null}
    </fieldset> : null}
    {error ? <p role="alert">{t(error)}</p> : null}
  </form>;
}
