import assert from "node:assert/strict";
import test from "node:test";
import { releaseNotes } from "../scripts/release-notes.mjs";

const changelog = "# Changelog\n\n## [Unreleased]\n\n- Future work\n\n## [0.1.1] - 2026-09-19\n\n### Fixed\n\n- Correct invoice export.\n\n## [0.1.0] - 2026-09-01\n\n- Previous version.\n";

test("release notes contain only the matching version, including CRLF files", () => {
  for (const text of [changelog, changelog.replaceAll("\n", "\r\n")]) {
    assert.equal(releaseNotes("v0.1.1", "0.1.1", text), "### Fixed\n\n- Correct invoice export.\n");
  }
});

test("release publication rejects mismatched tags and missing or empty entries", () => {
  for (const tag of ["v0.1.0", "0.1.1", "v0.1.1-rc.1", undefined]) {
    assert.throws(() => releaseNotes(tag, "0.1.1", changelog), /tag must match/);
  }
  assert.throws(() => releaseNotes("v0.1.2", "0.1.2", changelog), /Missing dated/);
  assert.throws(() => releaseNotes("v0.1.1", "0.1.1", "## [0.1.1] - 2026-09-19\n\n## [0.1.0] - 2026-09-01\n- Old"), /Empty/);
});
