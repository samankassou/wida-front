"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { SourceHighlight } from "@/lib/source-highlight";
import TransformedSource from "./transformed-source";
import HighlightOverlay from "./source-highlight";
import { useLanguage } from "./language-provider";

interface Props {
  url: string;
  zoom: number;
  rotation: number;
  region: SourceHighlight | null;
  selectionKey: string;
  label: string;
}

export default function PdfSource({ url, region, selectionKey, label, zoom, rotation }: Props) {
  const { t } = useLanguage();
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [navigation, setNavigation] = useState({ selectionKey, page: region?.pageNumber ?? 1 });
  const requestedPage = navigation.selectionKey === selectionKey ? navigation.page : region?.pageNumber ?? navigation.page;
  if (navigation.selectionKey !== selectionKey) {
    setNavigation({ selectionKey, page: requestedPage });
  }
  const pageNumber = Math.max(1, Math.min(pdf?.numPages ?? 1, requestedPage));

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => Promise<void>) | undefined;
    async function load() {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({ url, withCredentials: true,
          cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/" });
        destroy = () => task.destroy();
        const document = await task.promise;
        if (!cancelled) setPdf(document);
      } catch { if (!cancelled) setFailed(true); }
    }
    void load();
    return () => { cancelled = true; void destroy?.().catch(() => {}); };
  }, [url]);

  if (failed) return <div className="rv-pdf-fallback"><p role="status">{t("Highlight preview unavailable. Open the original to review this document.")}</p><a className="button" href={url} target="_blank" rel="noopener noreferrer">{t("Open original")}</a></div>;
  if (!pdf) return <p className="rv-source-status" role="status">{t("Loading document…")}</p>;
  return <>
    <div className="rv-page-controls">
      <button className="icon-button" type="button" aria-label={t("Previous page")} disabled={pageNumber <= 1} onClick={() => setNavigation({ selectionKey, page: pageNumber - 1 })}><ChevronLeft size={16} /></button>
      <span aria-live="polite">{t("Page {page} of {count}", { page: pageNumber, count: pdf.numPages })}</span>
      <button className="icon-button" type="button" aria-label={t("Next page")} disabled={pageNumber >= pdf.numPages} onClick={() => setNavigation({ selectionKey, page: pageNumber + 1 })}><ChevronRight size={16} /></button>
    </div>
    <TransformedSource zoom={zoom} rotation={rotation}><PdfPage key={pageNumber} pdf={pdf} pageNumber={pageNumber} region={region?.pageNumber === pageNumber ? region : null} selectionKey={`${selectionKey}:${zoom}:${rotation}`} label={label} /></TransformedSource>
  </>;
}

function PdfPage({ pdf, pageNumber, region, selectionKey, label }: { pdf: PDFDocumentProxy; pageNumber: number } & Pick<Props, "region" | "selectionKey" | "label">) {
  const { t } = useLanguage();
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  useEffect(() => {
    let cancelled = false;
    let cancelRender: (() => void) | undefined;
    const container = host.current!;
    async function render() {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        // A fresh canvas per render avoids overlapping PDF.js tasks in Strict Mode.
        const canvas = document.createElement("canvas");
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(2, 2400 / Math.max(viewport.width, viewport.height));
        const renderedViewport = page.getViewport({ scale });
        canvas.width = Math.ceil(renderedViewport.width);
        canvas.height = Math.ceil(renderedViewport.height);
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", t("Original PDF page {page}", { page: pageNumber }));
        const task = page.render({ canvas, viewport: renderedViewport });
        cancelRender = () => task.cancel();
        await task.promise;
        if (!cancelled) { container.replaceChildren(canvas); setStatus("ready"); }
      } catch { if (!cancelled) setStatus("failed"); }
    }
    void render();
    return () => { cancelled = true; cancelRender?.(); container.replaceChildren(); };
  }, [pdf, pageNumber, t]);
  return <div className="rv-source-page">
    {status !== "ready" ? <p className="rv-source-status" role="status">{status === "failed" ? t("Highlight preview unavailable. Open the original to review this document.") : t("Loading document…")}</p> : null}
    <div ref={host} className="rv-pdf-canvas" />
    {status === "ready" ? <HighlightOverlay region={region} label={label} selectionKey={selectionKey} /> : null}
  </div>;
}
