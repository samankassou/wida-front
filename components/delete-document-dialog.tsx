"use client";

import { useEffect, useRef } from "react";
import { CircleAlert, FileText, LoaderCircle, Trash2, X } from "lucide-react";
import { useLanguage } from "./language-provider";

interface Props {
  fileName: string | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteDocumentDialog({ fileName, busy, error, onClose, onConfirm }: Props) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const open = fileName !== null;

  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      cancel.current?.focus();
    } else {
      dialog.current?.close();
    }
  }, [open]);

  return <dialog ref={dialog} className="modal delete-modal" aria-labelledby="delete-document-title"
    aria-describedby="delete-document-description" aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget || busy) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <div className="modal-header">
      <div className="modal-symbol delete-modal-symbol"><Trash2 size={22} aria-hidden="true" /></div>
      <button className="icon-button" aria-label={t("Close dialog")} disabled={busy} onClick={onClose}><X size={19} /></button>
    </div>
    <h2 id="delete-document-title">{t("Delete this document?")}</h2>
    <p id="delete-document-description" className="modal-description">{t("The original file, invoice details and analysis history will be permanently removed. This cannot be undone.")}</p>
    <div className="delete-document-file"><FileText size={21} aria-hidden="true" /><span>{fileName}</span></div>
    {error ? <div className="delete-modal-error" role="alert"><CircleAlert size={17} aria-hidden="true" /><span>{t(error)}</span></div> : null}
    <div className="modal-footer delete-modal-footer">
      <button ref={cancel} className="button" disabled={busy} onClick={onClose}>{t("Cancel")}</button>
      <button className="button button-danger" disabled={busy} onClick={onConfirm}>
        {busy ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />}
        {busy ? t("Deleting…") : t("Delete document")}
      </button>
    </div>
  </dialog>;
}
