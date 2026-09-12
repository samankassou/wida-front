"use client";
import { useLanguage } from "./language-provider";

import { useLayoutEffect, useRef, useState } from "react";
import { ExternalLink, FileText, RotateCw, ScanLine, ZoomIn, ZoomOut } from "lucide-react";
import type { WorkspaceItem } from "@/lib/types";
import { fieldLabels, type HeaderField } from "@/lib/invoice-form";

interface Props {
  item: WorkspaceItem;
  sourceUrl: string | null;
  activeField: HeaderField | null;
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

function TransformedSource({ zoom, rotation, children }: { zoom: number; rotation: number; children: React.ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!container.current || !source.current) return;
    const measure = () => {
      const width = container.current?.clientWidth ?? 0;
      const height = source.current?.offsetHeight ?? 0;
      setDimensions((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container.current);
    observer.observe(source.current);
    measure();
    return () => observer.disconnect();
  }, []);
  const { width, height } = dimensions;
  const scale = zoom / 100;
  const quarterTurn = rotation === 90 || rotation === 270;
  const translateX = rotation === 90 ? height : rotation === 180 ? width : 0;
  const translateY = rotation === 180 ? height : rotation === 270 ? width : 0;
  const measured = width > 0 && height > 0;
  return <div className="rv-transform-container" ref={container}><div className="rv-transform-stage" style={measured ? { width: (quarterTurn ? height : width) * scale, height: (quarterTurn ? width : height) * scale } : undefined}><div className="rv-transform-source" ref={source} style={measured ? { width, position: "absolute", transform: `translate(${translateX * scale}px, ${translateY * scale}px) rotate(${rotation}deg) scale(${scale})` } : undefined}>{children}</div></div></div>;
}

export default function DocumentPreview({ item, sourceUrl, activeField, onFieldSelect }: Props) {
  const { t, formatLocale } = useLanguage();
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const sample = item.sample;
  const isImage = item.document.contentType.startsWith("image/");
  const isPdf = item.document.contentType === "application/pdf";
  const canTransform = Boolean(sample || (isImage && sourceUrl && !imageFailed));
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
      <div className={`rv-document-viewport ${isPdf && !sample ? "rv-pdf-viewport" : ""}`}>
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
          // Blob URLs and original document dimensions are deliberately preserved.
          // eslint-disable-next-line @next/next/no-img-element
          <TransformedSource zoom={zoom} rotation={rotation}><img className="rv-original-image" src={sourceUrl} alt={t("Original document: {name}", { name: item.document.originalFileName })} onError={() => setImageFailed(true)} /></TransformedSource>
        ) : sourceUrl && isPdf ? (
          <iframe className="rv-pdf" src={`${sourceUrl}#toolbar=1&view=FitH`} title={t("Original PDF: {name}", { name: item.document.originalFileName })} />
        ) : (
          <div className="rv-preview-empty"><div className="rv-preview-empty-icon"><ScanLine size={28} /></div><h3>{imageFailed ? t("This image cannot be previewed") : t("Original document")}</h3><p>{sourceUrl ? t("Open the original file to compare it with the invoice fields.") : t("The original preview will appear here when it is available.")}</p>{sourceUrl ? <a className="button" href={sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />{t("Open original")}</a> : null}</div>
        )}
      </div>
      <div className="rv-preview-footnote"><span>{sample ? t("Sample source · select a value to review it") : isPdf && sourceUrl ? t("Use the PDF toolbar to navigate the document.") : t("Compare the original with the fields on the right.")}</span>{sourceUrl && isPdf ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer">{t("Open original")} <ExternalLink size={12} /></a> : <span>{sample ? "1 / 1" : item.document.contentType.split("/")[1]?.toUpperCase()}</span>}</div>
    </section>
  );
}
