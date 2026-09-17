"use client";
import { useLanguage } from "./language-provider";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import TransformedSource from "./transformed-source";
import HighlightOverlay from "./source-highlight";
import { sourceHighlight } from "@/lib/source-highlight";

import { ExternalLink, FileText, RotateCw, ScanLine, ZoomIn, ZoomOut } from "lucide-react";
import type { ExtractedField, WorkspaceItem } from "@/lib/types";
import { fieldLabels, type HeaderField } from "@/lib/invoice-form";

const PdfSource = dynamic(() => import("./pdf-source"), { ssr: false });

interface Props {
  item: WorkspaceItem;
  sourceUrl: string | null;
  activeField: HeaderField | null;
  extracted?: ExtractedField;
  sourceLabel: string;
  selectionKey: string;
  onFieldSelect: (field: HeaderField) => void;
}

function displayAmount(value: string, locale: string, currency = "") {
  const parsed = Number(value);
  if (!value || !Number.isFinite(parsed)) return value || "—";
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsed)}${currency ? ` ${currency}` : ""}`;
}

function displayDate(value: string, locale: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

export default function DocumentPreview({ item, sourceUrl, activeField, onFieldSelect, extracted, sourceLabel, selectionKey }: Props) {
  const { t, formatLocale } = useLanguage();
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const region = useMemo(() => sourceHighlight(extracted), [extracted]);
  const highlightLabel = t("Source of {field}", { field: sourceLabel });
  const sample = item.sample;
  const isImage = item.document.contentType.startsWith("image/");
  const isPdf = item.document.contentType === "application/pdf";
  const canTransform = Boolean(sample || (sourceUrl && (isPdf || (isImage && !imageFailed))));
  const sourceButton = (field: HeaderField, content: React.ReactNode, className = "") => (
    <button type="button" className={`rv-source-value ${activeField === field ? "rv-source-active" : ""} ${className}`} onClick={() => onFieldSelect(field)} aria-label={t("Check {field}: {value}", { field: t(fieldLabels[field]), value: String(content) })}>
      {content}
    </button>
  );

  return (
    <section className="rv-preview" aria-label={t("Original document")}>
      <div className="rv-preview-toolbar">
        <div className="rv-preview-label"><FileText size={16} aria-hidden="true" /><span>{t("Original document")}</span></div>
        <div className="rv-preview-controls">
          {canTransform ? <>
            <button type="button" className="icon-button" onClick={() => setZoom((value) => Math.max(50, value - 25))} disabled={zoom <= 50} aria-label={t("Zoom out")}><ZoomOut size={16} /></button>
            <button type="button" className="rv-zoom-reset" onClick={() => { setZoom(100); setRotation(0); }} aria-label={t("Zoom {zoom} percent. Reset to fit.", { zoom })}>{zoom}%</button>
            <button type="button" className="icon-button" onClick={() => setZoom((value) => Math.min(200, value + 25))} disabled={zoom >= 200} aria-label={t("Zoom in")}><ZoomIn size={16} /></button>
            <span className="rv-toolbar-divider" />
            <button type="button" className="icon-button" onClick={() => setRotation((value) => (value + 90) % 360)} aria-label={t("Rotate document clockwise")}><RotateCw size={16} /></button>
          </> : null}
          {sourceUrl ? <a className="icon-button" href={sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={t("Open original document in a new tab")}><ExternalLink size={16} /></a> : null}
        </div>
      </div>
      <div className="rv-document-viewport">
        {sample ? (
          <TransformedSource zoom={zoom} rotation={rotation}>
            <article className="rv-paper" aria-label={t("Fictional sample invoice")}>
              <div className="rv-paper-top"><div className="rv-paper-monogram">{sample.supplierName.slice(0, 1)}</div><span>{t("INVOICE")}</span></div>
              <div className="rv-paper-brand">{sourceButton("supplierName", sample.supplierName)}</div>
              <p className="rv-paper-tagline">{t("Design & creative services")}</p>
              <div className="rv-paper-invoice-number">{sourceButton("invoiceNumber", sample.invoiceNumber)}</div>
              <div className="rv-paper-addresses"><div><span className="rv-paper-caption">{t("FROM")}</span><p>{sample.supplierName}<br />{sample.supplierAddress || "41 Alder Lane, Lyon, France"}</p></div><div><span className="rv-paper-caption">{t("BILL TO")}</span><p>Juniper Workshop<br />{t("Accounts team")}<br />Paris, France</p></div></div>
              <div className="rv-paper-dates"><div><span className="rv-paper-caption">{t("INVOICE DATE")}</span>{sourceButton("invoiceDate", displayDate(sample.invoiceDate, formatLocale))}</div><div><span className="rv-paper-caption">{t("DUE DATE")}</span>{sourceButton("dueDate", displayDate(sample.dueDate, formatLocale))}</div></div>
              <table className="rv-paper-lines"><thead><tr><th>{t("Description")}</th><th>{t("Qty")}</th><th>{t("Rate")}</th><th>{t("Amount")}</th></tr></thead><tbody>{sample.lines.length ? sample.lines.map((line) => <tr key={line.id}><td>{line.description || "Services"}</td><td>{line.quantity || "—"}</td><td>{displayAmount(line.unitPrice, formatLocale)}</td><td>{displayAmount(line.lineAmount, formatLocale)}</td></tr>) : <tr><td>{t("Professional services")}</td><td>1</td><td>{displayAmount(sample.subtotalAmount, formatLocale)}</td><td>{displayAmount(sample.subtotalAmount, formatLocale)}</td></tr>}</tbody></table>
              <div className="rv-paper-totals"><div><span>{t("Subtotal")}</span>{sourceButton("subtotalAmount", displayAmount(sample.subtotalAmount, formatLocale))}</div><div><span>{t("Tax")}</span>{sourceButton("taxAmount", displayAmount(sample.taxAmount, formatLocale))}</div><div className="rv-paper-total"><span>{t("Total due")}</span>{sourceButton("totalAmount", displayAmount(sample.totalAmount, formatLocale, sample.currency))}</div></div>
              <div className="rv-paper-payment"><span className="rv-paper-caption">{t("PAYMENT REFERENCE")}</span><p>{sample.invoiceNumber} · {sample.currency || "EUR"}<br />{t("Please include the invoice number with your transfer.")}</p></div>
              <footer className="rv-paper-footer"><span>{t("Thank you for working with us.")}</span><span>{t("Fictional sample · page 1 of 1")}</span></footer>
            </article>
          </TransformedSource>
        ) : sourceUrl && isImage && !imageFailed ? (
          <TransformedSource zoom={zoom} rotation={rotation}><div className="rv-source-page">
            {/* Blob URLs and original document dimensions are deliberately preserved. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="rv-original-image" src={sourceUrl} alt={t("Original document: {name}", { name: item.document.originalFileName })} onLoad={() => setImageReady(true)} onError={() => setImageFailed(true)} />
            <HighlightOverlay region={imageReady && region?.pageNumber === 1 ? region : null} label={highlightLabel} selectionKey={`${selectionKey}:${zoom}:${rotation}`} />
          </div></TransformedSource>
        ) : sourceUrl && isPdf ? (
          <PdfSource key={sourceUrl} url={sourceUrl} region={region} selectionKey={selectionKey} label={highlightLabel} zoom={zoom} rotation={rotation} />
        ) : (
          <div className="rv-preview-empty"><div className="rv-preview-empty-icon"><ScanLine size={28} /></div><h3>{imageFailed ? t("This image cannot be previewed") : t("Original document")}</h3><p>{sourceUrl ? t("Open the original file to compare it with the invoice fields.") : t("The original preview will appear here when it is available.")}</p>{sourceUrl ? <a className="button" href={sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />{t("Open original")}</a> : null}</div>
        )}
      </div>
      <div className="rv-preview-footnote"><span>{sample ? t("Sample source · select a value to review it") : region && (isPdf || (isImage && region.pageNumber === 1 && !imageFailed)) ? highlightLabel : t("No source location for this field. Compare with the original.")}</span>{sourceUrl && isPdf ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer">{t("Open original")} <ExternalLink size={12} /></a> : <span>{sample ? "1 / 1" : item.document.contentType.split("/")[1]?.toUpperCase()}</span>}</div>
    </section>
  );
}
