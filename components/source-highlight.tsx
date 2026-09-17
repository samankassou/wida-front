"use client";

import { useEffect, useRef } from "react";
import type { SourceHighlight } from "@/lib/source-highlight";

export default function HighlightOverlay({ region, label, selectionKey }: { region: SourceHighlight | null; label: string; selectionKey: string }) {
  const polygon = useRef<SVGPolygonElement>(null);
  useEffect(() => {
    const element = polygon.current;
    const viewport = element?.closest(".rv-document-viewport");
    if (!element || !(viewport instanceof HTMLElement)) return;
    // Scroll only the document pane; keep keyboard focus and the form in place.
    const frame = requestAnimationFrame(() => {
      const target = element.getBoundingClientRect();
      const bounds = viewport.getBoundingClientRect();
      if (!target.width || !target.height) return;
      if (target.top < bounds.top || target.bottom > bounds.bottom || target.left < bounds.left || target.right > bounds.right) {
        viewport.scrollBy({ top: target.top + target.height / 2 - bounds.top - bounds.height / 2, left: target.left + target.width / 2 - bounds.left - bounds.width / 2, behavior: "instant" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [selectionKey, region]);
  if (!region) return null;
  return <svg className="rv-highlight-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={label}>
    <title>{label}</title>
    <polygon ref={polygon} points={region.points.map(([x, y]) => `${x * 100},${y * 100}`).join(" ")} vectorEffect="non-scaling-stroke" />
  </svg>;
}
