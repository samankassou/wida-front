"use client";
import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, FileText, LoaderCircle, UploadCloud, X, ArrowRight } from "lucide-react";
import type { WorkspaceItem, WorkspaceMode } from "@/lib/types";
import { sizeLabel } from "@/lib/format";
import { ApiError } from "@/lib/api";

interface Entry { id: string; file: File; status: "ready" | "uploading" | "done" | "error"; message?: string; documentId?: string }
interface Props { open: boolean; onClose: () => void; mode: WorkspaceMode; onUpload: (file: File, extract: boolean) => Promise<WorkspaceItem>; onReview: (id: string) => void }
export default function UploadDialog({ open, onClose, mode, onUpload, onReview }: Props) {
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
      if (file.size === 0 || file.size > 20 * 1024 * 1024) { problems.push(`${file.name}: files must be between 1 byte and 20 MB.`); continue; }
      if ([...entries, ...additions].some(entry => entry.file.name === file.name && entry.file.size === file.size)) continue;
      additions.push({ id: crypto.randomUUID(), file, status: "ready" });
    }
    setEntries(previous => [...previous, ...additions].slice(0, 20));
    if (entries.length + additions.length > 20) problems.push("Add up to 20 documents at a time.");
    setError(problems.join(" ")); if (input.current) input.current.value = "";
  }
  async function upload() {
    if (busy) return; setBusy(true); setError("");
    for (const entry of ready) {
      setEntries(previous => previous.map(row => row.id === entry.id ? { ...row, status: "uploading", message: undefined } : row));
      try {
        const item = await onUpload(entry.file, mode === "live" && extract);
        setEntries(previous => previous.map(row => row.id === entry.id ? { ...row, status: "done", documentId: item.document.id, message: item.latestRun?.status === "Failed" ? "Uploaded. Extraction needs another try." : undefined } : row));
      } catch (cause) { setEntries(previous => previous.map(row => row.id === entry.id ? { ...row, status: "error", message: cause instanceof ApiError && cause.errors.file ? cause.errors.file : cause instanceof Error ? cause.message : "Upload failed. Please try again." } : row)); }
    }
    setBusy(false);
  }
  function close() { if (!busy) { onClose(); setEntries([]); setError(""); } }
  return <dialog ref={dialog} className="modal upload-modal" aria-labelledby="upload-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="modal-header"><div className="modal-symbol"><UploadCloud size={23} /></div><button className="icon-button" aria-label="Close upload" onClick={close} disabled={busy}><X size={19} /></button></div>
    <h2 id="upload-title">Give your paperwork a new home.</h2><p className="modal-description">Upload invoices and turn the details into organized records.</p>
    {mode === "demo" ? <p className="inline-note"><CircleAlert size={16} /><span>Demo workspace. Files stay in this browser; enter their details manually. Sample documents demonstrate extraction.</span></p> : null}
    <button type="button" className={`dropzone ${dragging ? "is-dragging" : ""}`} disabled={busy} onClick={() => input.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!busy) addFiles(event.dataTransfer.files); }}><span className="dropzone-icon"><UploadCloud size={28} /></span><strong>Drop your documents here</strong><span>or <b>browse files</b> on your computer</span><small>PDF, PNG, JPG or TIFF · Up to 20 MB each</small></button>
    <input ref={input} type="file" className="visually-hidden" multiple accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff" onChange={event => { if (event.target.files) addFiles(event.target.files); }} aria-label="Choose invoice files" tabIndex={-1} />
    {error ? <p role="alert" className="field-error upload-error">{error}</p> : null}
    {entries.length ? <ul className="upload-list" aria-label="Selected files">{entries.map(entry => <li key={entry.id}><span className="file-icon"><FileText size={19} /></span><div><strong>{entry.file.name}</strong><small className={entry.status === "error" ? "field-error" : ""}>{entry.message || (entry.status === "uploading" ? mode === "live" && extract ? "Uploading and extracting…" : "Saving document…" : entry.status === "done" ? "Document added" : sizeLabel(entry.file.size))}</small></div>{entry.status === "uploading" ? <LoaderCircle size={19} className="spin" /> : entry.status === "done" ? <Check size={19} className="success-text" /> : <button className="icon-button" aria-label={`Remove ${entry.file.name}`} disabled={busy} onClick={() => setEntries(previous => previous.filter(row => row.id !== entry.id))}><X size={16} /></button>}</li>)}</ul> : null}
    {mode === "live" ? <label className="check-label upload-option"><input type="checkbox" checked={extract} disabled={busy} onChange={event => setExtract(event.target.checked)} /><span><strong>Extract invoice details automatically</strong><small>You can review and correct every value before saving.</small></span></label> : null}
    <div className="modal-footer"><span aria-live="polite">{done.length ? `${done.length} of ${entries.length} added` : "Your originals stay with each invoice."}</span>{done.length > 0 && !ready.length && !busy ? <button className="button button-primary" onClick={() => { const id = done[0].documentId!; close(); onReview(id); }}>Review document<ArrowRight size={16} /></button> : <button className="button button-primary" onClick={upload} disabled={!ready.length || busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <UploadCloud size={16} />}{busy ? "Working…" : `Upload${ready.length ? ` ${ready.length} document${ready.length === 1 ? "" : "s"}` : " documents"}`}</button>}</div>
  </dialog>;
}
