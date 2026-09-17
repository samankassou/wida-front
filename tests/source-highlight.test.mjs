import assert from "node:assert/strict";
import test from "node:test";
import { sourceHighlight } from "../lib/source-highlight.ts";

const field = (boundingBox, pageNumber = 2) => ({ boundingBox, pageNumber });
const box = { polygon: [1, 2, 3, 2, 3, 4, 1, 4], pageWidth: 10, pageHeight: 20, unit: "inch" };

test("normalizes Azure coordinates using the source page dimensions", () => {
  assert.deepEqual(sourceHighlight(field(box)), { pageNumber: 2, points: [[.1,.1],[.3,.1],[.3,.2],[.1,.2]] });
  assert.deepEqual(sourceHighlight(field({ ...box, unit: "pixel", polygon: box.polygon.map(v => v * 100), pageWidth: 1000, pageHeight: 2000 })), sourceHighlight(field(box)));
});

test("does not guess coordinates for legacy, absent, or malformed geometry", () => {
  for (const value of [null, [1,2,3,4], {}, { ...box, pageWidth: 0 }, { ...box, pageHeight: Infinity }, { ...box, polygon: [1,2,3] }, { ...box, polygon: [1,2,NaN,3,4,5] }, { ...box, polygon: [1,2,3,4,5,6] }, { ...box, polygon: [1,2,30,2,30,4,1,4] }]) {
    assert.equal(sourceHighlight(field(value)), null);
  }
  for (const pageNumber of [null, 0, -1, 1.5, Infinity]) assert.equal(sourceHighlight(field(box, pageNumber)), null);
  assert.equal(sourceHighlight(undefined), null);
});

test("allows minor edge rounding without drawing outside the page", () => {
  const region = sourceHighlight(field({ ...box, polygon: [-.01, 0, 10.01, 0, 10, 20, 0, 20] }));
  assert.deepEqual(region.points, [[0,0],[1,0],[1,1],[0,1]]);
});
