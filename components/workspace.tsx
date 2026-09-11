"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Bell, ArrowDownUp, ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCheck, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Clock3, Download, FileCheck2, FileText, FolderOpen, HelpCircle, Inbox, LoaderCircle, LogOut, Menu, Plus, ReceiptText, RefreshCw, ScanLine, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, X } from "lucide-react";
import * as api from "@/lib/api";
import { getDemoItems, getDemoRun } from "@/lib/demo-data";
import { amountOf, currencyOf, dateLabel, money, numberOf, stageLabels, stageOf, supplierOf } from "@/lib/format";
import { resolveDraft, toInvoicePayload, validateDraft } from "@/lib/invoice-form";
import { getDocumentFile, hasLiveDrafts, loadWorkspace, putDocumentFile, saveWorkspace } from "@/lib/storage";
import { isAnalysisActive, mergeAnalysisResult, mergeInvoiceResult, mergePolledAnalysis, nextReviewItem } from "@/lib/workspace-state";
import type { DocumentStage, FieldErrors, Invoice, ProcessingRun, ReviewDraft, SessionUser, WorkspaceItem, WorkspaceMode } from "@/lib/types";
import UploadDialog from "./upload-dialog";
import AnalysisActivity from "./analysis-activity";
import { analysisLabel, analysisRequestMessage, type UploadResult } from "@/lib/processing";
import { useReviewDrafts } from "./use-review-drafts";

const InvoiceReview = dynamic(() => import("./invoice-review"), { loading: () => <div className="review-loading"><LoaderCircle className="spin" /><p>Opening your document…</p></div> });
const demoItems = getDemoItems();
type Filter = "all" | DocumentStage;
type Panel = "settings" | "help" | null;
const filters: { key: Filter; label: string }[] = [{ key: "all", label: "All documents" }, { key: "review", label: "Needs review" }, { key: "processing", label: "In progress" }, { key: "saved", label: "Saved" }, { key: "failed", label: "Needs attention" }];

function StatusBadge({ stage, queued = false }: { stage: DocumentStage; queued?: boolean }) {
  const Icon = stage === "saved" ? CheckCircle2 : stage === "review" ? CircleAlert : stage === "processing" ? queued ? Clock3 : LoaderCircle : stage === "failed" ? CircleAlert : Clock3;
  return <span className={`badge badge-${stage}`}><Icon size={13} className={stage === "processing" && !queued ? "spin" : ""} />{queued && stage === "processing" ? "Queued" : stageLabels[stage]}</span>;
}
function csvValue(value: unknown) { const text = String(value ?? ""); return `"${(/^[\s]*[=+@-]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`; }

export default function Workspace({ mode, user, apiSession, onLogout }: { mode: WorkspaceMode; user?: SessionUser; apiSession?: api.ApiSession; onLogout?: () => Promise<void> }) {
  const client = useMemo(() => api.createApiClient(apiSession), [apiSession]);
  const userId = user?.id;
  const initials = user ? (user.displayName || user.email).split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() : "W";
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const view = params.get("view") === "invoices" ? "invoices" : params.get("document") ? "review" : "documents";
  const selectedId = params.get("document");
  const [items, setItems] = useState<WorkspaceItem[]>(mode === "demo" ? demoItems : []);
  const itemsRef = useRef(items);
  const currentDocumentId = useRef(selectedId);
  const workspaceRevision = useRef(0);
  const workspaceStorageFailed = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query.trim().toLowerCase());
  const [filter, setFilter] = useState<Filter>("all");
  const [currency, setCurrency] = useState("");
  const [period, setPeriod] = useState("all");
  const [filterNow] = useState(() => Date.now());
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [analysisUpdates, setAnalysisUpdates] = useState<ProcessingRun[]>([]);
  const [statusUnavailable, setStatusUnavailable] = useState(false);
  const [analysisWarnings, setAnalysisWarnings] = useState<Record<string, string>>({});
  const { drafts, restoreDraft, storeDraft, discardDraft, hasFailedDrafts } = useReviewDrafts(mode, userId);
  const activeSaves = useRef(new Set<string>());
  const activeAnalyses = useRef(new Set<string>());
  const [savingDocuments, setSavingDocuments] = useState<Set<string>>(() => new Set());
  const [analyzingDocuments, setAnalyzingDocuments] = useState<Set<string>>(() => new Set());
  const saving = selectedId !== null && savingDocuments.has(selectedId);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [workspaceStorageWarning, setWorkspaceStorageWarning] = useState(false);
  const storageWarning = workspaceStorageWarning || hasFailedDrafts;
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [runs, setRuns] = useState<ProcessingRun[]>([]);
  const [theme, setTheme] = useState("light");
  const searchInput = useRef<HTMLInputElement>(null);
  const panelDialog = useRef<HTMLDialogElement>(null);
  const filterPopover = useRef<HTMLDetailsElement>(null);
  const allCheckbox = useRef<HTMLInputElement>(null);
  const item = items.find(row => row.document.id === selectedId);
  const analyzing = (selectedId !== null && analyzingDocuments.has(selectedId)) || isAnalysisActive(item?.latestRun);
  const hasQueuedAnalysis = items.some(row => isAnalysisActive(row.latestRun));
  const draft = item ? resolveDraft(item, drafts[item.document.id]) : null;
  const notify = useCallback((message: string) => setToast(message), [setToast]);
  useEffect(() => { currentDocumentId.current = selectedId; }, [selectedId]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 4500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    let active = true;
    const revision = workspaceRevision.current;
    Promise.resolve().then(async () => {
      try { const records = mode === "demo" ? loadWorkspace() ?? getDemoItems() : await client.fetchWorkspace(); if (active && revision === workspaceRevision.current) { itemsRef.current = records; setItems(records); setLoadError(null); } }
      catch (cause) { if (active) setLoadError(cause instanceof Error ? cause.message : "Unable to load documents."); }
      finally { if (active) setLoading(false); }
      try { const saved = localStorage.getItem("wida:theme:v1"); if (active && (saved === "dark" || saved === "light")) setTheme(saved); } catch { /* Default appearance. */ }
    });
    return () => { active = false; };
  }, [mode, client]);
  useEffect(() => {
    if (mode !== "live" || !hasQueuedAnalysis) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    async function poll() {
      const pending = itemsRef.current.flatMap(row => isAnalysisActive(row.latestRun) ? [row.latestRun!] : []);
      const results = await Promise.allSettled(pending.map(run => client.fetchRun(run.id)));
      if (!active) return;
      let records = itemsRef.current;
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const run = result.value;
        const merged = mergePolledAnalysis(records, run);
        if (merged === records) continue;
        records = merged;
        if (run.status === "Completed" || run.status === "Failed") {
          setAnalysisUpdates(previous => [run, ...previous.filter(existing => existing.documentId !== run.documentId)].slice(0, 10));
          const name = records.find(row => row.document.id === run.documentId)?.document.originalFileName || "Document";
          notify(`${name}: ${analysisLabel(run).toLowerCase()}.`);
        }
        if (currentDocumentId.current === run.documentId) {
          setRuns(previous => [run, ...previous.filter(existing => existing.documentId === run.documentId && existing.id !== run.id)]);

        }
      }
      if (records !== itemsRef.current) {
        workspaceRevision.current++;
        itemsRef.current = records;
        setItems(records);
      }
      failures = results.some(result => result.status === "rejected") ? failures + 1 : 0;
      setStatusUnavailable(failures > 0);
      if (failures === 3) notify("Analysis status is temporarily unavailable. We’ll keep checking; your edits are preserved.");
      timer = setTimeout(poll, failures ? 10000 : 3000);
    }
    timer = setTimeout(poll, 3000);
    return () => { active = false; clearTimeout(timer); };
  }, [mode, client, hasQueuedAnalysis, notify]);
  useEffect(() => {
    if (!selectedId) return;
    let active = true; let objectUrl: string | null = null;
    Promise.resolve().then(async () => {
      if (!active) return;
      setRuns([]); setSourceUrl(null); setSaveError(null); setServerErrors({});
      restoreDraft(selectedId);
      if (mode === "live") {
        if (active) setSourceUrl(`/api/wida/documents/${encodeURIComponent(selectedId)}/content`);
        try { const result = await client.fetchRuns(selectedId); if (active) setRuns(result); }
        catch { if (active) notify("Processing history couldn't be loaded. You can still review this document."); }
      } else {
        try { const file = await getDocumentFile(selectedId); if (!active) return; if (file) objectUrl = URL.createObjectURL(file); setSourceUrl(objectUrl); }
        catch { if (active) setSourceUrl(null); }
      }
    });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [selectedId, mode, userId, client, notify, restoreDraft]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNav(false);
        if (filterPopover.current?.open) { filterPopover.current.open = false; filterPopover.current.querySelector("summary")?.focus(); }
      }
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable || panelDialog.current?.open || uploadOpen) return;
      if (event.key === "/" && view !== "review") { event.preventDefault(); searchInput.current?.focus(); }
      if (event.key.toLowerCase() === "u" && !event.metaKey && !event.ctrlKey && !event.altKey) { event.preventDefault(); setUploadOpen(true); }
      if (event.key === "?") setPanel("help");
    };
    const closeFilters = (event: PointerEvent) => { if (filterPopover.current?.open && !filterPopover.current.contains(event.target as Node)) filterPopover.current.open = false; };
    window.addEventListener("keydown", keydown); window.addEventListener("pointerdown", closeFilters);
    return () => { window.removeEventListener("keydown", keydown); window.removeEventListener("pointerdown", closeFilters); };
  }, [view, uploadOpen]);
  useEffect(() => { if (panel) panelDialog.current?.showModal(); else panelDialog.current?.close(); }, [panel]);
  useEffect(() => {
    if (!storageWarning) return;
    const preventLoss = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", preventLoss); return () => window.removeEventListener("beforeunload", preventLoss);
  }, [storageWarning]);
  function persist(records: WorkspaceItem[], requireDurable = false): boolean {
    const persisted = mode !== "demo" || saveWorkspace(records);
    workspaceStorageFailed.current = !persisted;
    setWorkspaceStorageWarning(!persisted);
    // A failed invoice save must remain an editable draft, without a Saved badge.
    if (!persisted && requireDurable) return false;
    workspaceRevision.current++;
    itemsRef.current = records; setItems(records);
    return persisted;
  }
  function navigate(destination: "documents" | "invoices") { currentDocumentId.current = null; router.push(destination === "documents" ? "/" : "/?view=invoices", { scroll: false }); setMobileNav(false); setSelected(new Set()); setPage(1); setFilter("all"); setSaveError(null); }
  function openItem(id: string) { currentDocumentId.current = id; setSourceUrl(null); setRuns([]); setSaveError(null); setServerErrors({}); router.push(`/?document=${encodeURIComponent(id)}`, { scroll: false }); setMobileNav(false); }
  async function refresh() {
    setLoading(true); setLoadError(null);
    const revision = workspaceRevision.current;
    try {
      if (mode === "demo" && workspaceStorageFailed.current) {
        notify("Your current documents have been kept. Browser storage could not be updated; keep this tab open and try saving again.");
        return;
      }
      const records = mode === "live" ? await client.fetchWorkspace() : loadWorkspace() ?? getDemoItems();
      if (revision === workspaceRevision.current) {
        itemsRef.current = records; setItems(records);
        setAnalysisWarnings(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => !records.find(row => row.document.id === id)?.latestRun)));
      }
    }
    catch (cause) { setLoadError(cause instanceof Error ? cause.message : "Unable to refresh documents."); }
    finally { setLoading(false); }
  }
  async function onUpload(file: File, extract: boolean): Promise<UploadResult> {
    let analysisError: string | undefined;
    let added: WorkspaceItem;
    if (mode === "demo") {
      const id = crypto.randomUUID(); await putDocumentFile(id, file);
      const extension = file.name.toLowerCase().split(".").at(-1);
      const type = file.type || (extension === "pdf" ? "application/pdf" : extension === "png" ? "image/png" : extension === "tif" || extension === "tiff" ? "image/tiff" : "image/jpeg");
      added = { document: { id, originalFileName: file.name, contentType: type, documentType: "Unknown", status: "Uploaded", uploadedAt: new Date().toISOString() }, invoice: null, latestRun: null };
    } else {
      added = { document: await client.uploadDocument(file), invoice: null, latestRun: null };
      if (extract) {
        try { added.latestRun = await client.analyzeDocument(added.document.id); }
        catch (cause) {
          analysisError = analysisRequestMessage(cause instanceof api.ApiError ? cause.status : undefined);
          // A lost response is not a failed processing run. Recover the server state when possible.
          try { added.latestRun = (await client.fetchRuns(added.document.id))[0] ?? null; if (added.latestRun) analysisError = undefined; } catch { /* Keep the saved upload and its request warning. */ }
        }
      }
    }
    persist([added, ...itemsRef.current]);
    if (analysisError) setAnalysisWarnings(previous => ({ ...previous, [added.document.id]: analysisError }));
    return { item: added, analysisError };
  }
  async function signOut() {
    if (!onLogout || !userId || loggingOut) return;
    if (activeSaves.current.size || activeAnalyses.current.size || uploadOpen) {
      notify("Finish the current operation and close the upload dialog before signing out.");
      return;
    }
    if ((hasLiveDrafts(userId) || hasFailedDrafts) && !window.confirm("Sign out and remove this tab’s unsaved drafts? Save your invoices first if you want to keep these changes.")) return;
    setLoggingOut(true);
    try { await onLogout(); }
    catch (cause) { notify(cause instanceof Error ? cause.message : "Sign out failed. Please try again."); }
    finally { setLoggingOut(false); }
  }
  function changeDraft(updated: ReviewDraft) {
    if (!item) return;
    storeDraft(item, updated);
    setSaveError(null); setServerErrors({});
  }
  async function onSave(updated: ReviewDraft) {
    if (!item) return;
    const documentId = item.document.id;
    if (activeSaves.current.has(documentId)) throw new Error("This invoice is already being saved.");
    const errors = validateDraft(updated, item);
    if (Object.keys(errors).length) { setServerErrors(errors); throw new Error("Please check the highlighted fields."); }
    activeSaves.current.add(documentId); setSavingDocuments(new Set(activeSaves.current));
    storeDraft(item, updated);
    setSaveError(null); setServerErrors({});
    try {
      const payload = toInvoicePayload(updated.values, documentId);
      const invoice: Invoice = mode === "live" ? await client.saveInvoice(payload, item.invoice?.id) : { ...payload, id: item.invoice?.id ?? crypto.randomUUID(), createdAt: item.invoice?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
      const records = mergeInvoiceResult(itemsRef.current, documentId, invoice);
      if (!persist(records, true)) throw new Error("This browser could not save the invoice. Your draft has been kept. Free some browser storage, then try Save again.");
      discardDraft(documentId);
      notify(currentDocumentId.current === documentId ? item.invoice ? "Invoice changes saved." : "Invoice saved. One less thing on your list." : `${item.document.originalFileName}: invoice saved.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The invoice could not be saved. Your draft has been kept.";
      if (currentDocumentId.current === documentId) { if (cause instanceof api.ApiError) setServerErrors(cause.errors); setSaveError(message); }
      else notify(`${item.document.originalFileName}: ${message}`);
      throw cause;
    }
    finally { activeSaves.current.delete(documentId); setSavingDocuments(new Set(activeSaves.current)); }
  }
  async function analyze() {
    if (!item) return;
    const documentId = item.document.id;
    if (activeAnalyses.current.has(documentId) || isAnalysisActive(item.latestRun)) return;
    if (mode === "demo" && !item.sample) { notify("This file is stored locally. Enter the invoice details manually, or connect the API to extract them."); return; }
    activeAnalyses.current.add(documentId); setAnalyzingDocuments(new Set(activeAnalyses.current)); setSaveError(null);
    try {
      const run = mode === "demo" ? { ...getDemoRun(item), id: crypto.randomUUID() } : await client.analyzeDocument(documentId);
      setAnalysisWarnings(previous => { const next = { ...previous }; delete next[documentId]; return next; });
      const records = mergeAnalysisResult(itemsRef.current, documentId, run);
      persist(records);
      if (currentDocumentId.current === documentId) {
        setRuns(previous => [run, ...previous.filter(existing => existing.documentId === documentId && existing.id !== run.id)]);
        notify(isAnalysisActive(run) ? "Analysis queued. You can leave this page while it runs." : run.status === "Failed" ? "Extraction failed. You can retry or enter the details manually." : "Extraction finished. Your document is ready to review.");
      } else notify(`${item.document.originalFileName}: ${isAnalysisActive(run) ? "analysis queued." : run.status === "Failed" ? "extraction failed." : "extraction finished."}`);
    } catch (cause) {
      const message = analysisRequestMessage(cause instanceof api.ApiError ? cause.status : undefined);
      setAnalysisWarnings(previous => ({ ...previous, [documentId]: message }));
      if (currentDocumentId.current === documentId) setSaveError(message); else notify(`${item.document.originalFileName}: ${message}`);
    }
    finally { activeAnalyses.current.delete(documentId); setAnalyzingDocuments(new Set(activeAnalyses.current)); }
  }
  const activeItems = items.filter(row => isAnalysisActive(row.latestRun));
  const recentUpdates = analysisUpdates.filter(run => items.some(row => row.document.id === run.documentId && row.latestRun?.id === run.id && !isAnalysisActive(row.latestRun)));
  const counts = items.reduce((acc, row) => { acc[stageOf(row)]++; return acc; }, { review: 0, saved: 0, uploaded: 0, processing: 0, failed: 0 });
  const reviewQueue = items.filter(row => !row.invoice && (stageOf(row) === "review" || stageOf(row) === "uploaded") && (!selected.size || selected.has(row.document.id)));
  const nextReview = nextReviewItem(items, reviewQueue, selectedId);
  const base = view === "invoices" ? items.filter(row => row.invoice) : items;
  const currencies = Array.from(new Set(items.map(currencyOf).filter(Boolean))).sort();
  const visible = base.filter(row => {
    if (filter !== "all" && (filter === "processing" ? !isAnalysisActive(row.latestRun) : stageOf(row) !== filter)) return false;
    if (currency && currencyOf(row) !== currency) return false;
    if (period !== "all" && new Date(row.document.uploadedAt).getTime() < filterNow - Number(period) * 86400000) return false;
    return !search || [supplierOf(row), row.document.originalFileName, numberOf(row), currencyOf(row)].some(value => value.toLowerCase().includes(search));
  }).sort((a, b) => sort === "supplier" ? supplierOf(a).localeCompare(supplierOf(b)) : (new Date(b.document.uploadedAt).getTime() - new Date(a.document.uploadedAt).getTime()) * (sort === "oldest" ? -1 : 1));
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageItems = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allSelected = pageItems.length > 0 && pageItems.every(row => selected.has(row.document.id));
  const someSelected = pageItems.some(row => selected.has(row.document.id));
  useEffect(() => { if (allCheckbox.current) allCheckbox.current.indeterminate = someSelected && !allSelected; }, [someSelected, allSelected]);
  function toggleSelection(id: string) { setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function clearFilters() { setQuery(""); setFilter("all"); setCurrency(""); setPeriod("all"); setPage(1); }
  function exportInvoices() {
    const rows = visible.filter(row => row.invoice && (!selected.size || selected.has(row.document.id)));
    if (!rows.length) { notify("Select saved invoices to export their values."); return; }
    const lines = [["Supplier", "Invoice number", "Invoice date", "Due date", "Currency", "Subtotal", "Tax", "Total", "Original document"], ...rows.map(row => { const invoice = row.invoice!; return [invoice.supplierName, invoice.invoiceNumber, invoice.invoiceDate, invoice.dueDate, invoice.currency, invoice.subtotalAmount, invoice.taxAmount, invoice.totalAmount, row.document.originalFileName]; })];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + lines.map(line => line.map(csvValue).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `wida-invoices-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`${rows.length} invoice${rows.length === 1 ? "" : "s"} exported.`);
  }

  return <div className={`workspace theme-${theme}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    {mobileNav ? <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} /> : null}
    <aside id="workspace-sidebar" className={`sidebar ${mobileNav ? "is-open" : ""}`}>
      <button className="brand" onClick={() => navigate("documents")} aria-label="Wida home"><span className="brand-mark"><ScanLine size={23} strokeWidth={2} /></span>wida<span className="brand-dot">.</span></button>
      <div className="workspace-identity"><span className="workspace-avatar">W</span><div><strong>My workspace</strong><small>{mode === "demo" ? "Personal · Demo" : "Personal workspace"}</small></div><span className="identity-dot" /></div>
      <p className="nav-label">WORKSPACE</p>
      <nav aria-label="Main navigation"><button className={`nav-item ${view !== "invoices" ? "active" : ""}`} onClick={() => navigate("documents")} aria-current={view !== "invoices" ? "page" : undefined}><Inbox size={19} /><span>Documents</span><span className="nav-count">{items.length}</span></button><button className={`nav-item ${view === "invoices" ? "active" : ""}`} onClick={() => navigate("invoices")} aria-current={view === "invoices" ? "page" : undefined}><ReceiptText size={19} /><span>Invoices</span></button></nav>
      <div className="sidebar-divider" /><p className="nav-label">QUICK VIEWS</p>
      <button className="nav-item subnav" onClick={() => { navigate("documents"); setFilter("review"); }}><span className="nav-status-dot amber" /><span>Needs review</span><span className="quiet-count">{counts.review}</span></button><button className="nav-item subnav" onClick={() => { navigate("documents"); setFilter("failed"); }}><span className="nav-status-dot rose" /><span>Needs attention</span>{counts.failed ? <span className="quiet-count">{counts.failed}</span> : null}</button>
      <div className="sidebar-bottom"><div className="sidebar-tip"><span className="tip-symbol"><Sparkles size={18} /></span><strong>A lighter way to work.</strong><p>From scattered paperwork to clear, organized records.</p><button onClick={() => setPanel("help")}>Take a quick tour<ArrowUpRight size={14} /></button></div><button className="nav-item" onClick={() => setPanel("settings")}><Settings2 size={18} /><span>Workspace settings</span></button><button className="nav-item" onClick={() => setPanel("help")}><HelpCircle size={18} /><span>Help & shortcuts</span></button><div className="sidebar-profile"><span className="profile-avatar" aria-hidden="true">{initials}</span><div className="profile-details"><strong>{user?.displayName || "Your workspace"}</strong><small title={user?.email}>{user?.email || "Stored on this device"}</small></div>{onLogout ? <button className="icon-button profile-logout" aria-label="Sign out" title="Sign out" onClick={signOut} disabled={loggingOut}>{loggingOut ? <LoaderCircle size={17} className="spin" /> : <LogOut size={17} />}</button> : <span className="connection-dot" />}</div></div>
    </aside>
    <div className="workspace-body"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label={mobileNav ? "Close navigation" : "Open navigation"} aria-expanded={mobileNav} aria-controls="workspace-sidebar" onClick={() => setMobileNav(previous => !previous)}><Menu size={20} /></button><span>Workspace</span><ChevronRight size={13} /><strong>{view === "invoices" ? "Invoices" : "Documents"}</strong>{view === "review" ? <><ChevronRight size={13} /><span className="breadcrumb-detail">Review</span></> : null}</div><div className="topbar-actions"><span className={`connection-label ${mode === "demo" ? "demo" : ""}`}><span />{mode === "demo" ? "Demo workspace" : loadError ? "Connection unavailable" : "Live workspace"}</span><button className="icon-button help-icon" aria-label="Help and keyboard shortcuts" onClick={() => setPanel("help")}><HelpCircle size={18} /></button><span className="topbar-separator" /><span className="topbar-avatar" aria-label={user ? `Signed in as ${user.email}` : "Personal workspace"}>{initials}</span></div></header>
    <main id="main-content" className={view === "review" ? "main-content review-main" : "main-content"}>
      {mode === "live" ? <AnalysisActivity items={items} activeItems={activeItems} recentUpdates={recentUpdates} statusUnavailable={statusUnavailable} onOpen={openItem} onDismiss={() => setAnalysisUpdates([])} /> : null}
      {mode === "live" && Object.keys(analysisWarnings).length ? <section className="processing-activity" aria-label="Analysis requests needing attention"><div className="processing-activity-heading"><strong>Uploads saved · Analysis needs attention</strong><button className="button button-small" onClick={refresh} disabled={loading}>Refresh status</button></div><ul>{Object.entries(analysisWarnings).map(([id, message]) => <li key={id}><button onClick={() => openItem(id)}><span><CircleAlert size={17} /><strong>{items.find(row => row.document.id === id)?.document.originalFileName}</strong></span><span>Open document<ArrowRight size={15} /></span></button><p className="processing-request-warning">{message}</p></li>)}</ul></section> : null}
      {storageWarning ? <div className="error-banner" role="alert"><CircleAlert size={18} /><span>Browser storage is full or unavailable. Keep this tab open and save your invoice before leaving.</span></div> : null}
      {view === "review" ? item && draft ? <InvoiceReview key={item.document.id} item={item} draft={draft} onDraftChange={changeDraft} onSave={onSave} onBack={() => navigate("documents")} onNext={() => { if (nextReview) openItem(nextReview.document.id); }} hasNext={Boolean(nextReview)} saving={saving} mode={mode} sourceUrl={sourceUrl} runs={mode === "demo" ? item.latestRun ? [item.latestRun] : [] : runs} onAnalyze={analyze} analyzing={analyzing} serverErrors={serverErrors} error={saveError || (selectedId ? analysisWarnings[selectedId] : null)} /> : loading ? <div className="review-loading"><LoaderCircle className="spin" />Loading document…</div> : <div className="empty-state"><FolderOpen /><h2>We couldn’t find this document</h2><p>{loadError || "The link may be outdated, or the document belongs to another workspace."}</p><button className="button" onClick={() => navigate("documents")}><ArrowLeft size={16} />Back to documents</button></div> : <>
      <section className="page-heading"><div><div className="eyebrow">YOUR PAPERWORK, SIMPLIFIED</div><h1>{view === "invoices" ? "Invoices" : "Documents"}<span className="title-dot">.</span></h1><p>{view === "invoices" ? "Checked, saved, and ready for whatever comes next." : "A place for every document. A clear path for every invoice."}</p></div><div className="page-actions">{view === "invoices" ? <button className="button" onClick={exportInvoices} disabled={!counts.saved}><Download size={16} />Export CSV</button> : null}<button className="button button-primary" onClick={() => setUploadOpen(true)}><Plus size={18} />Upload documents</button></div></section>
      {mode === "demo" ? <div className="demo-banner"><span className="demo-banner-icon"><Sparkles size={16} /></span><span><strong>Make yourself at home.</strong> Explore with sample invoices, or upload a document to try manual entry.</span><button onClick={() => setPanel("settings")}>About this workspace<ArrowRight size={14} /></button></div> : null}
      {view === "documents" ? <section className="summary-grid" aria-label="Workspace overview">
        <button className={`summary-card ${filter === "review" ? "selected" : ""}`} onClick={() => { setFilter("review"); setPage(1); }}><span className="summary-top"><span>Ready to review</span><span className="summary-icon amber"><FileText size={18} /></span></span><span className="summary-value">{counts.review.toString().padStart(2, "0")}<span>documents</span></span><span className="summary-bottom"><span className="small-dot amber" />A quick check makes all the difference<ArrowUpRight size={15} /></span></button>
        <button className={`summary-card ${filter === "saved" ? "selected" : ""}`} onClick={() => { setFilter("saved"); setPage(1); }}><span className="summary-top"><span>Invoices saved</span><span className="summary-icon green"><FileCheck2 size={18} /></span></span><span className="summary-value">{counts.saved.toString().padStart(2, "0")}<span>invoices</span></span><span className="summary-bottom"><span className="small-dot green" />Organized and ready when you need them<ArrowUpRight size={15} /></span></button>
        <button className={`summary-card ${filter === "failed" ? "selected" : ""}`} onClick={() => { setFilter("failed"); setPage(1); }}><span className="summary-top"><span>Needs attention</span><span className="summary-icon rose"><CircleAlert size={18} /></span></span><span className="summary-value">{counts.failed.toString().padStart(2, "0")}<span>{counts.failed === 1 ? "document" : "documents"}</span></span><span className="summary-bottom"><span className="small-dot rose" />{counts.failed ? "A retry or a little help from you" : "Everything is moving along nicely"}<ArrowUpRight size={15} /></span></button>
      </section> : null}
      <section className="documents-panel" aria-label={view === "invoices" ? "Saved invoices" : "Document inbox"}>
        <div className="panel-heading"><div><h2>{view === "invoices" ? "Your invoice records" : "Document inbox"}</h2><span className="record-count">{base.length}</span></div><div className="panel-heading-actions"><span className="quiet-label">{mode === "demo" ? "Local workspace" : "Latest 500 documents"}</span><button className="icon-button" onClick={refresh} aria-label="Refresh documents" disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} /></button></div></div>
        {view === "documents" ? <div className="filter-tabs" aria-label="Document views">{filters.map(tab => <button key={tab.key} className={filter === tab.key ? "active" : ""} aria-pressed={filter === tab.key} onClick={() => { setFilter(tab.key); setPage(1); }}>{tab.label}<span>{tab.key === "all" ? items.length : tab.key === "processing" ? activeItems.length : counts[tab.key]}</span></button>)}</div> : null}
        <div className="table-toolbar"><div className="search-box"><Search size={17} /><input ref={searchInput} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search documents, suppliers, invoice numbers…" aria-label="Search documents" />{query ? <button className="icon-button" aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button> : <kbd>/</kbd>}</div><div className="toolbar-filters"><details ref={filterPopover} className="filter-popover"><summary><SlidersHorizontal size={15} />Filters{currency || period !== "all" ? <span className="filter-indicator" /> : null}</summary><div className="filter-content"><label>Currency<select aria-label="Currency" value={currency} onChange={event => { setCurrency(event.target.value); setPage(1); }}><option value="">All currencies</option>{currencies.map(code => <option key={code}>{code}</option>)}</select></label><label>Uploaded<select aria-label="Uploaded date range" value={period} onChange={event => { setPeriod(event.target.value); setPage(1); }}><option value="all">Any time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label><button className="button button-small" onClick={() => { setCurrency(""); setPeriod("all"); }}>Reset filters</button></div></details><label className="sort-select"><ArrowDownUp size={15} /><span className="visually-hidden">Sort documents</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="supplier">Supplier A–Z</option></select></label></div></div>
        {selected.size ? <div className="selection-bar"><span><CheckCheck size={16} />{selected.size} selected</span><button onClick={() => { const target = items.find(row => selected.has(row.document.id)); if (target) openItem(target.document.id); }}>Review selected<ArrowRight size={14} /></button><button onClick={exportInvoices}><Download size={14} />Export saved invoices</button><button className="selection-clear" aria-label="Clear selection" onClick={() => setSelected(new Set())}><X size={16} /></button></div> : null}
        {loadError ? <div className="error-banner" role="alert"><CircleAlert size={19} /><div><strong>Let’s get you connected again.</strong><p>{loadError}</p></div><button className="button button-small" onClick={refresh}>Try again</button></div> : loading ? <div className="table-skeleton" aria-label="Loading documents" aria-busy="true">{Array.from({ length: 5 }, (_, index) => <div key={index}><span /><span /><span /></div>)}</div> : !visible.length ? <div className="empty-state"><span className="empty-icon">{search || filter !== "all" || currency || period !== "all" ? <Search size={25} /> : <Inbox size={28} />}</span><h3>{base.length ? "No documents match this view" : view === "invoices" ? "Your first saved invoice starts here" : "A fresh start for your paperwork"}</h3><p>{base.length ? "Try another search or clear your filters to see more." : view === "invoices" ? "Review a document and save its details to build your invoice library." : "Upload an invoice to keep the original and its details together."}</p><button className="button" onClick={() => base.length ? clearFilters() : view === "invoices" ? navigate("documents") : setUploadOpen(true)}>{base.length ? "Clear filters" : view === "invoices" ? "Go to documents" : "Upload your first document"}<ArrowRight size={15} /></button></div> : <div className="document-table-wrap"><table className="document-table"><thead><tr><th className="checkbox-cell"><input ref={allCheckbox} type="checkbox" aria-label="Select all documents on this page" checked={allSelected} onChange={() => setSelected(previous => { const next = new Set(previous); for (const row of pageItems) if (allSelected) next.delete(row.document.id); else next.add(row.document.id); return next; })} /></th><th>Document</th><th>Status</th><th className="date-cell">{view === "invoices" ? "Invoice date" : "Uploaded"}</th><th className="amount-cell">Amount</th><th className="row-action-cell"><span className="visually-hidden">Open</span></th></tr></thead><tbody>{pageItems.map(row => { const stage = stageOf(row); return <tr key={row.document.id} className={selected.has(row.document.id) ? "row-selected" : ""}><td className="checkbox-cell"><input type="checkbox" aria-label={`Select ${supplierOf(row)}`} checked={selected.has(row.document.id)} onChange={() => toggleSelection(row.document.id)} /></td><td><div className="document-name-cell"><span className={`document-type-icon ${row.document.contentType.startsWith("image") ? "image-file" : ""}`}><FileText size={21} /><small>{row.document.contentType.startsWith("image") ? "IMG" : "PDF"}</small></span><div><button className="document-link" onClick={() => openItem(row.document.id)}>{supplierOf(row)}</button><span className="document-filename">{view === "invoices" ? numberOf(row) : row.document.originalFileName}</span><span className="mobile-amount">{money(amountOf(row), currencyOf(row))}</span></div></div></td><td><StatusBadge stage={stage} queued={row.latestRun?.status === "Pending"} />{stage === "saved" && isAnalysisActive(row.latestRun) ? <span className="document-filename">{analysisLabel(row.latestRun!)}</span> : null}</td><td className="date-cell"><span>{dateLabel(view === "invoices" && row.invoice?.invoiceDate ? row.invoice.invoiceDate : row.document.uploadedAt)}</span><small>{view === "invoices" ? row.invoice?.dueDate ? `Due ${dateLabel(row.invoice.dueDate)}` : "No due date" : numberOf(row) || "Ready for extraction"}</small></td><td className="amount-cell"><strong>{money(amountOf(row), currencyOf(row))}</strong><small>{currencyOf(row) || "Not extracted"}</small></td><td className="row-action-cell"><button className="icon-button row-open" aria-label={`Open ${supplierOf(row)}`} onClick={() => openItem(row.document.id)}><ArrowUpRight size={17} /></button></td></tr>; })}</tbody></table></div>}
        <div className="table-footer"><span>{visible.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, visible.length)}` : "0"} of {visible.length} {view === "invoices" ? visible.length === 1 ? "invoice" : "invoices" : visible.length === 1 ? "document" : "documents"}{search ? " found" : ""}</span><div><label className="rows-per-page">Rows per page<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}><option>10</option><option>25</option><option>50</option></select></label><button className="icon-button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17} /></button><span className="page-number">{currentPage} / {pages}</span><button className="icon-button" aria-label="Next page" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17} /></button></div></div>
      </section>
      <footer className="workspace-footer"><span><ShieldCheck size={15} />Your originals. Your data. Everything in one place.</span><span>{mode === "demo" ? "Sample data · Saved in this browser" : "Wida document workspace"}</span></footer>
      </>}
    </main></div>
    <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} mode={mode} onUpload={onUpload} onReview={openItem} />
    <dialog ref={panelDialog} className="modal settings-modal" aria-labelledby="panel-title" onCancel={() => setPanel(null)} onClick={event => { if (event.target === event.currentTarget) setPanel(null); }}><div className="modal-header"><div className="modal-symbol">{panel === "help" ? <HelpCircle /> : <Settings2 />}</div><button className="icon-button" aria-label="Close dialog" onClick={() => setPanel(null)}><X size={19} /></button></div><h2 id="panel-title">{panel === "help" ? "A little guidance goes a long way." : "Make this workspace yours."}</h2>{panel === "help" ? <><p className="modal-description">Three simple steps to a lighter document workflow.</p><ol className="tour-steps"><li><span>1</span><div><strong>Bring your documents together</strong><p>Upload a PDF or image. In a connected workspace, Wida extracts the invoice details.</p></div></li><li><span>2</span><div><strong>Give the details a quick check</strong><p>Compare the fields with your original. Confirm uncertain values and add anything missing.</p></div></li><li><span>3</span><div><strong>Save it and move forward</strong><p>Find saved records in Invoices, edit their details, or export them as CSV.</p></div></li></ol><div className="keyboard-guide"><h3>Keyboard shortcuts</h3><p><span>Search documents</span><kbd>/</kbd></p><p><span>Upload documents</span><kbd>U</kbd></p><p><span>Open this guide</span><kbd>?</kbd></p><p><span>Close a dialog</span><kbd>Esc</kbd></p></div></> : <><p className="modal-description">A few preferences for your day-to-day work.</p><div className="setting-row"><div><strong>Appearance</strong><p>Choose the view that feels right.</p></div><div className="segmented-control">{["light", "dark"].map(value => <button key={value} aria-pressed={theme === value} onClick={() => { setTheme(value); try { localStorage.setItem("wida:theme:v1", value); } catch { /* Applied for this visit. */ } }}>{value === "light" ? "Light" : "Dark"}</button>)}</div></div><div className="connection-card"><div><span className="connection-dot" /><strong>{mode === "demo" ? "Demo workspace" : "Wida API workspace"}</strong></div><p>{mode === "demo" ? "You’re working with fictional samples. Your changes and uploaded files are saved on this device. Automatic extraction for new uploads is available when the API is connected." : "Documents and saved invoices are stored by your Wida server. In-progress form drafts stay in this browser tab until you save them."}</p></div><div className="setting-note"><ShieldCheck size={20} /><p>Processing and verification are separate steps. Wida keeps the original extraction confidence visible, even after you correct a value.</p></div></>}<div className="modal-footer"><span>Less paperwork. More clarity.</span><button className="button button-primary" onClick={() => setPanel(null)}>Got it<Check size={16} /></button></div></dialog>
    {toast ? <div className="toast" role="status"><Bell size={19} /><span>{toast}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast("")}><X size={15} /></button></div> : null}
  </div>;
}
