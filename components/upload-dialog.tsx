"use client";
import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, FileText, LoaderCircle, UploadCloud, X, ArrowRight } from "lucide-react";
import type { WorkspaceMode } from "@/lib/types";
import { sizeLabel } from "@/lib/format";
import type { UploadResult } from "@/lib/processing";
import { analysisLabel } from "@/lib/processing";
import { ApiError } from "@/lib/api";

interface Entry { id: string; file: File; status: "ready" | "uploading" | "done" | "error"; message?: string; documentId?: string; warning?: boolean }
interface Props { isAdmin?: boolean; open: boolean; onClose: () => void; mode: WorkspaceMode; onUpload: (file: File, extract: boolean) => Promise<UploadResult>; onReview: (id: string) => void }
export default function UploadDialog({ isAdmin = false, open, onClose, mode, onUpload, onReview }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [extract, setExtract] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  const ready = entries.filter(entry => entry.status === "ready" || entry.status === "error");
  const done = entries.filter(entry => entry.status === "done");
  function addFiles(files: FileList | File[]) {
    const additions: Entry[] = []; const problems: string[] = [];
    for (const file of Array.from(files)) {
      if (!/\.(pdf|png|jpe?g|tiff?)$/i.test(file.name)) { problems.push(`${file.name}: use a PDF, PNG, JPG, or TIFF file.`); continue; }
      if (file.size === 0 || (!isAdmin && file.size > 4 * 1024 * 1024)) { problems.push(isAdmin ? `${file.name}: the file is empty.` : `${file.name}: choose a non-empty file up to 4 MB.`); continue; }
      if ([...entries, ...additions].some(entry => entry.file.name === file.name && entry.file.size === file.size)) continue;
      additions.push({ id: crypto.randomUUID(), file, status: "ready" });
    }
    setEntries(previous => isAdmin ? [...previous, ...additions] : [...previous, ...additions].slice(0, 20));
    if (!isAdmin && entries.length + additions.length > 20) problems.push("Add up to 20 documents at a time.");
    setError(problems.join(" ")); if (input.current) input.current.value = "";
  }
  async function upload() {
    if (busy) return; setBusy(true); setError("");
    for (const entry of ready) {
      setEntries(previous => previous.map(row => row.id === entry.id ? { ...row, status: "uploading", message: undefined } : row));
      try {
        const { item, analysisError } = await onUpload(entry.file, mode === "live" && extract);
        setEntries(previous => previous.map(row => row.id === entry.id ? { ...row, status: "done", documentId: item.document.id, warning: Boolean(analysisError) || item.latestRun?.status === "Failed", message: analysisError || (item.latestRun ? item.latestRun.status === "Pending" || item.latestRun.status === "Running" ? "Document added. Analysis in progress." : `Document saved. ${analysisLabel(item.latestRun)}.` : "Document added. You can enter its details.") } : row));
      } catch (cause) { setEntries(previous => previous.map(row => row.id === entry.id ? { ...row, status: "error", message: cause instanceof ApiError && cause.errors.file ? cause.errors.file : cause instanceof Error ? cause.message : "Upload failed. Please try again." } : row)); }
    }
    setBusy(false);
  }
  function close() { if (!busy) { onClose(); setEntries([]); setError(""); } }
  return <dialog ref={dialog} className="modal upload-modal" aria-labelledby="upload-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="modal-header"><div className="modal-symbol"><UploadCloud size={23} /></div><button className="icon-button" aria-label="Close upload" onClick={close} disabled={busy}><X size={19} /></button></div>
    <h2 id="upload-title">Upload documents</h2>
    {mode === "demo" ? <p className="inline-note"><CircleAlert size={16} /><span>Demo files stay in this browser. Enter their invoice details manually.</span></p> : null}
    <button type="button" className={`dropzone ${dragging ? "is-dragging" : ""}`} disabled={busy} onClick={() => input.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!busy) addFiles(event.dataTransfer.files); }}><span className="dropzone-icon"><UploadCloud size={28} /></span><strong>Drop your documents here</strong><span>or <b>browse files</b> on your computer</span><small>{isAdmin ? "PDF, PNG, JPG or TIFF" : "PDF, PNG, JPG or TIFF · 2 pages maximum · Up to 4 MB each"}</small></button>
    <input ref={input} type="file" className="visually-hidden" multiple accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff" onChange={event => { if (event.target.files) addFiles(event.target.files); }} aria-label="Choose invoice files" tabIndex={-1} />
    {error ? <p role="alert" className="field-error upload-error">{error}</p> : null}
    {entries.length ? <ul className="upload-list" aria-label="Selected files">{entries.map(entry => <li key={entry.id}><span className="file-icon"><FileText size={19} /></span><div><strong>{entry.file.name}</strong><small className={entry.status === "error" || entry.warning ? "field-error" : ""}>{entry.message || (entry.status === "uploading" ? mode === "live" && extract ? "Uploading…" : "Saving document…" : entry.status === "done" ? "Document added" : sizeLabel(entry.file.size))}</small></div>{entry.status === "uploading" ? <LoaderCircle size={19} className="spin" /> : entry.status === "done" && entry.warning ? <CircleAlert size={19} /> : entry.status === "done" ? <Check size={19} className="success-text" /> : <button className="icon-button" aria-label={`Remove ${entry.file.name}`} disabled={busy} onClick={() => setEntries(previous => previous.filter(row => row.id !== entry.id))}><X size={16} /></button>}</li>)}</ul> : null}
    {mode === "live" ? <label className="check-label upload-option"><input type="checkbox" checked={extract} disabled={busy} onChange={event => setExtract(event.target.checked)} /><span><strong>Fill in invoice details automatically</strong><small>You can keep working while we read your documents.</small></span></label> : null}
    {done.length > 0 && !busy ? <p className="inline-note"><Check size={16} /><span>{mode === "live" ? "You can close this window. Follow the analysis from your documents." : "Your files are saved in this browser. Open a document to enter its details."}</span></p> : null}
    <div className="modal-footer"><span aria-live="polite">{done.length ? `${done.length} of ${entries.length} added` : ""}</span>{done.length > 0 && !ready.length && !busy ? <div className="upload-complete-actions"><button className="button" onClick={() => { const id = done[0].documentId!; close(); onReview(id); }}>Open document<ArrowRight size={16} /></button><button className="button button-primary" onClick={close}>Done</button></div> : <button className="button button-primary" onClick={upload} disabled={!ready.length || busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <UploadCloud size={16} />}{busy ? "Working…" : `Upload${ready.length ? ` ${ready.length} document${ready.length === 1 ? "" : "s"}` : " documents"}`}</button>}</div>
  </dialog>;
}
