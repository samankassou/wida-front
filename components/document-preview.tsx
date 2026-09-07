"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ExternalLink, FileText, RotateCw, ScanLine, ZoomIn, ZoomOut } from "lucide-react";
import type { WorkspaceItem } from "@/lib/types";
import type { HeaderField } from "@/lib/invoice-form";

interface Props {
  item: WorkspaceItem;
  sourceUrl: string | null;
  activeField: HeaderField | null;
  onFieldSelect: (field: HeaderField) => void;
}

function displayAmount(value: string, currency = "") {
  const parsed = Number(value);
  if (!value || !Number.isFinite(parsed)) return value || "—";
  return `${new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsed)}${currency ? ` ${currency}` : ""}`;
}

function displayDate(value: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const sample = item.sample;
  const isImage = item.document.contentType.startsWith("image/");
  const isPdf = item.document.contentType === "application/pdf";
  const canTransform = Boolean(sample || (isImage && sourceUrl && !imageFailed));
  const sourceButton = (field: HeaderField, content: React.ReactNode, className = "") => (
    <button type="button" className={`rv-source-value ${activeField === field ? "rv-source-active" : ""} ${className}`} onClick={() => onFieldSelect(field)} aria-label={`Check ${field.replace(/([A-Z])/g, " $1").toLowerCase()}: ${String(content)}`}>
      {content}
    </button>
  );

  return (
    <section className="rv-preview" aria-label="Original document">
      <div className="rv-preview-toolbar">
        <div className="rv-preview-label"><FileText size={16} aria-hidden="true" /><span>Original document</span></div>
        <div className="rv-preview-controls">
          {canTransform ? <>
            <button type="button" className="icon-button" onClick={() => setZoom((value) => Math.max(50, value - 25))} disabled={zoom <= 50} aria-label="Zoom out"><ZoomOut size={16} /></button>
            <button type="button" className="rv-zoom-reset" onClick={() => { setZoom(100); setRotation(0); }} aria-label={`Zoom ${zoom} percent. Reset to fit.`}>{zoom}%</button>
            <button type="button" className="icon-button" onClick={() => setZoom((value) => Math.min(200, value + 25))} disabled={zoom >= 200} aria-label="Zoom in"><ZoomIn size={16} /></button>
            <span className="rv-toolbar-divider" />
            <button type="button" className="icon-button" onClick={() => setRotation((value) => (value + 90) % 360)} aria-label="Rotate document clockwise"><RotateCw size={16} /></button>
          </> : null}
          {sourceUrl ? <a className="icon-button" href={sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="Open original document in a new tab"><ExternalLink size={16} /></a> : null}
        </div>
      </div>
      <div className={`rv-document-viewport ${isPdf && !sample ? "rv-pdf-viewport" : ""}`}>
        {sample ? (
          <TransformedSource zoom={zoom} rotation={rotation}>
            <article className="rv-paper" aria-label="Fictional sample invoice">
              <div className="rv-paper-top"><div className="rv-paper-monogram">{sample.supplierName.slice(0, 1)}</div><span>INVOICE</span></div>
              <div className="rv-paper-brand">{sourceButton("supplierName", sample.supplierName)}</div>
              <p className="rv-paper-tagline">Design &amp; creative services</p>
              <div className="rv-paper-invoice-number">{sourceButton("invoiceNumber", sample.invoiceNumber)}</div>
              <div className="rv-paper-addresses"><div><span className="rv-paper-caption">FROM</span><p>{sample.supplierName}<br />{sample.supplierAddress || "41 Alder Lane, Lyon, France"}</p></div><div><span className="rv-paper-caption">BILL TO</span><p>Juniper Workshop<br />Accounts team<br />Paris, France</p></div></div>
              <div className="rv-paper-dates"><div><span className="rv-paper-caption">INVOICE DATE</span>{sourceButton("invoiceDate", displayDate(sample.invoiceDate))}</div><div><span className="rv-paper-caption">DUE DATE</span>{sourceButton("dueDate", displayDate(sample.dueDate))}</div></div>
              <table className="rv-paper-lines"><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{sample.lines.length ? sample.lines.map((line) => <tr key={line.id}><td>{line.description || "Services"}</td><td>{line.quantity || "—"}</td><td>{displayAmount(line.unitPrice)}</td><td>{displayAmount(line.lineAmount)}</td></tr>) : <tr><td>Professional services</td><td>1</td><td>{displayAmount(sample.subtotalAmount)}</td><td>{displayAmount(sample.subtotalAmount)}</td></tr>}</tbody></table>
              <div className="rv-paper-totals"><div><span>Subtotal</span>{sourceButton("subtotalAmount", displayAmount(sample.subtotalAmount))}</div><div><span>Tax</span>{sourceButton("taxAmount", displayAmount(sample.taxAmount))}</div><div className="rv-paper-total"><span>Total due</span>{sourceButton("totalAmount", displayAmount(sample.totalAmount, sample.currency))}</div></div>
              <div className="rv-paper-payment"><span className="rv-paper-caption">PAYMENT REFERENCE</span><p>{sample.invoiceNumber} · {sample.currency || "EUR"}<br />Please include the invoice number with your transfer.</p></div>
              <footer className="rv-paper-footer"><span>Thank you for working with us.</span><span>Fictional sample · page 1 of 1</span></footer>
            </article>
          </TransformedSource>
        ) : sourceUrl && isImage && !imageFailed ? (
          // Blob URLs and original document dimensions are deliberately preserved.
          // eslint-disable-next-line @next/next/no-img-element
          <TransformedSource zoom={zoom} rotation={rotation}><img className="rv-original-image" src={sourceUrl} alt={`Original document: ${item.document.originalFileName}`} onError={() => setImageFailed(true)} /></TransformedSource>
        ) : sourceUrl && isPdf ? (
          <iframe className="rv-pdf" src={`${sourceUrl}#toolbar=1&view=FitH`} title={`Original PDF: ${item.document.originalFileName}`} />
        ) : (
          <div className="rv-preview-empty"><div className="rv-preview-empty-icon"><ScanLine size={28} /></div><h3>{imageFailed ? "This image cannot be previewed" : "Original document"}</h3><p>{sourceUrl ? "Open the original file to compare it with the invoice fields." : "The original preview will appear here when it is available."}</p>{sourceUrl ? <a className="button" href={sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />Open original</a> : null}</div>
        )}
      </div>
      <div className="rv-preview-footnote"><span>{sample ? "Sample source · select a value to review it" : isPdf && sourceUrl ? "Use the PDF toolbar to navigate the document." : "Compare the original with the fields on the right."}</span>{sourceUrl && isPdf ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Open original <ExternalLink size={12} /></a> : <span>{sample ? "1 / 1" : item.document.contentType.split("/")[1]?.toUpperCase()}</span>}</div>
    </section>
  );
}
