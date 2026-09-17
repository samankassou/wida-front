import type { ExtractedField } from "./types";

export interface SourceHighlight {
  pageNumber: number;
  /** Coordinates normalized to the displayed page, with a top-left origin. */
  points: [number, number][];
}

/** Never guess units for older extractions that only stored a polygon. */
export function sourceHighlight(field: ExtractedField | undefined): SourceHighlight | null {
  const box = field?.boundingBox;
  if (!field || !Number.isInteger(field.pageNumber) || (field.pageNumber ?? 0) < 1 ||
      !box || typeof box !== "object" || Array.isArray(box)) return null;
  const { polygon, pageWidth, pageHeight } = box as Record<string, unknown>;
  if (typeof pageWidth !== "number" || !Number.isFinite(pageWidth) || pageWidth <= 0 ||
      typeof pageHeight !== "number" || !Number.isFinite(pageHeight) || pageHeight <= 0 ||
      !Array.isArray(polygon) || polygon.length < 6 || polygon.length % 2 !== 0 ||
      !polygon.every(value => typeof value === "number" && Number.isFinite(value))) return null;
  const points: [number, number][] = [];
  for (let index = 0; index < polygon.length; index += 2) {
    const x = polygon[index] / pageWidth;
    const y = polygon[index + 1] / pageHeight;
    // Allow minor rounding at page edges, but reject unrelated coordinate systems.
    if (x < -0.01 || x > 1.01 || y < -0.01 || y > 1.01) return null;
    points.push([Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))]);
  }
  const area = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0);
  return Math.abs(area) > 0.00000001 ? { pageNumber: field.pageNumber!, points } : null;
}
