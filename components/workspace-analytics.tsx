"use client";
import { useLanguage } from "./language-provider";

import { useState } from "react";
import { ArrowUpRight, FileCheck2, FileText, Info, CircleAlert } from "lucide-react";
import { stageOf } from "@/lib/format";
import type { DocumentStage, WorkspaceItem } from "@/lib/types";

export default function WorkspaceAnalytics({ items, onFilter }: { items: WorkspaceItem[]; onFilter: (stage: DocumentStage) => void }) {
  const { t, formatLocale } = useLanguage();
  const months = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat(formatLocale, { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month, 1))));
  const [chosenYear, setChosenYear] = useState<number | null>(null);
  const [activeMonth, setActiveMonth] = useState<number | null>(null);
  const years = [...new Set(items.map(item => new Date(item.document.uploadedAt).getUTCFullYear()).filter(Number.isFinite))].sort((a, b) => b - a);
  const year = chosenYear ?? years[0] ?? new Date().getUTCFullYear();
  const buckets = months.map(() => ({ uploaded: 0, saved: 0 }));
  for (const item of items) {
    const date = new Date(item.document.uploadedAt);
    if (date.getUTCFullYear() !== year) continue;
    buckets[date.getUTCMonth()].uploaded++;
    if (stageOf(item) === "saved") buckets[date.getUTCMonth()].saved++;
  }
  const maximum = Math.max(4, ...buckets.map(bucket => bucket.uploaded));
  const saved = items.filter(item => stageOf(item) === "saved").length;
  const percentage = items.length ? Math.round(saved / items.length * 100) : 0;
  const statuses = [{ stage: "saved", label: "Invoices saved", Icon: FileCheck2 }, { stage: "review", label: "Ready to review", Icon: FileText }, { stage: "failed", label: "Needs attention", Icon: CircleAlert }] as const;
  return <section className="workspace-analytics" aria-label={t("Document analytics")}>
    <div className="activity-card">
      <div className="analytics-heading"><h2>{t("Document activity")} <Info size={14} aria-hidden="true" /></h2><select aria-label={t("Activity year")} value={year} onChange={event => { setChosenYear(Number(event.target.value)); setActiveMonth(null); }}>{(years.length ? years : [year]).map(value => <option key={value}>{value}</option>)}</select></div>
      <div className="chart-legend"><span><i />{t("Uploaded")}</span><span><i />{t("Currently saved")}</span></div>
      <div className="activity-chart"><div className="chart-axis" aria-hidden="true"><span>{maximum}</span><span>{maximum / 2}</span><span>0</span></div>
        <div className="chart-columns">{buckets.map((bucket, index) => <button key={months[index]} className={`chart-month ${activeMonth === index ? "is-active" : ""}`} aria-label={t("{month} {year}: {uploaded} uploaded, {saved} currently saved", { month: months[index], year, uploaded: bucket.uploaded, saved: bucket.saved })} onMouseEnter={() => setActiveMonth(index)} onMouseLeave={() => setActiveMonth(null)} onFocus={() => setActiveMonth(index)} onBlur={() => setActiveMonth(null)} onClick={() => setActiveMonth(index)}>
          <span className="chart-bars"><span className="chart-bar uploaded-bar" style={{ height: `${bucket.uploaded / maximum * 100}%` }} /><span className="chart-bar saved-bar" style={{ height: `${bucket.saved / maximum * 100}%` }} /></span><span className="chart-month-label">{months[index]}</span>
          {activeMonth === index ? <span className="chart-tooltip"><strong>{months[index]} {year}</strong><span>{t("Uploaded")} <b>{bucket.uploaded}</b></span><span>{t("Currently saved")} <b>{bucket.saved}</b></span></span> : null}
        </button>)}</div>
      </div><p className="chart-caption">{t("By upload month · Saved counts reflect current status")}</p>
    </div>
    <div className="health-card"><div className="analytics-heading"><h2>{t("Workspace summary")}</h2><FileCheck2 size={16} /></div><div className="health-total">{percentage}<span>%</span></div><p className="health-description">{t("of your documents saved as invoices")}</p><div className="health-progress">{statuses.map(({ stage, label, Icon }) => {
      const count = items.filter(item => stageOf(item) === stage).length;
      const percent = items.length ? Math.round(count / items.length * 100) : 0;
      return <button key={stage} onClick={() => onFilter(stage)}><span className="health-icon"><Icon size={17} /></span><span className="health-metric"><span>{t(label)}<strong>{count}</strong></span><span className="health-track"><span style={{ width: `${percent}%` }} /></span><small>{percent}{t("% of documents")}</small></span><ArrowUpRight size={13} /></button>;
    })}</div></div>
  </section>;
}
