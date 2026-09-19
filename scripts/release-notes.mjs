import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function releaseNotes(tag, version, changelog) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag) || tag !== `v${version}`) {
    throw new Error("Release tag must match the stable version in package.json.");
  }
  const lines = changelog.split(/\r?\n/);
  const heading = `## [${version}] - `;
  const start = lines.findIndex(line => line.startsWith(heading) && /^\d{4}-\d{2}-\d{2}$/.test(line.slice(heading.length)));
  if (start < 0) throw new Error(`Missing dated changelog entry for ${version}.`);
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const notes = lines.slice(start + 1, end < 0 ? undefined : end).join("\n").trim();
  if (!notes) throw new Error(`Empty changelog entry for ${version}.`);
  return `${notes}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
  process.stdout.write(releaseNotes(process.argv[2], version, changelog));
}
