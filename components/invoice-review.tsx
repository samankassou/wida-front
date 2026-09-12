"use client";
import { useLanguage } from "./language-provider";

import ProcessingProgress from "./processing-progress";
import { analysisFailureMessage, analysisLabel } from "@/lib/processing";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCheck, ChevronDown, ChevronRight, CircleAlert, Clock3, FileText, History, Layers3, LoaderCircle, Plus, RotateCw, Save, ShieldCheck, Trash2 } from "lucide-react";
import DocumentPreview from "./document-preview";
import { createDraft, emptyLine, fieldLabels, fieldNeedsCheck, getExtractedField, getExtractedLineField, lineCheckKey, taxInclusiveLineNet, numericValue, validateDraft, type HeaderField } from "@/lib/invoice-form";
import type { ExtractedField, FieldErrors, InvoiceLineDraft, ProcessingRun, ReviewDraft, WorkspaceItem, WorkspaceMode } from "@/lib/types";
import "./invoice-review.css";

interface Props {
  item: WorkspaceItem;
  draft: ReviewDraft;
  onDraftChange: (draft: ReviewDraft) => void;
  onSave: (draft: ReviewDraft) => Promise<void>;
  onBack: () => void;
  onNext: () => void;
  hasNext: boolean;
  saving: boolean;
  mode: WorkspaceMode;
  sourceUrl: string | null;
  runs: ProcessingRun[];
  onAnalyze: () => void;
  analyzing: boolean;
  serverErrors: FieldErrors;
  error: string | null;
}

type Tab = "details" | "lines" | "history";

interface FieldProps {
  name: HeaderField;
  value: string;
  type?: "text" | "date";
  required?: boolean;
  placeholder?: string;
  wide?: boolean;
  extracted?: ExtractedField;
  checked: boolean;
  error?: string;
  showError: boolean;
  onChange: (name: HeaderField, value: string) => void;
  onCheck: (name: HeaderField, checked: boolean) => void;
  onFocus: (name: HeaderField) => void;
  onBlur: (name: HeaderField) => void;
}

function InvoiceField({ name, value, type = "text", required, placeholder, wide, extracted, checked, error, showError, onChange, onCheck, onFocus, onBlur }: FieldProps) {
  const { t } = useLanguage();
  const needsCheck = fieldNeedsCheck(extracted);
  const isAmount = name.endsWith("Amount");
  const id = `rv-field-${name}`;
  const invalid = Boolean(error && showError);
  return (
    <div className={`rv-field ${wide ? "rv-field-wide" : ""} ${needsCheck && !checked ? "rv-field-review" : ""} ${invalid ? "rv-field-invalid" : ""}`}>
      <div className="rv-field-label"><label htmlFor={id}>{t(fieldLabels[name])}{required ? <span aria-hidden="true"> *</span> : null}</label>{needsCheck ? <span className={`rv-confidence ${checked ? "" : "rv-confidence-low"}`}>{checked ? <Check size={12} aria-hidden="true" /> : <CircleAlert size={12} aria-hidden="true" />}{checked ? t("Checked") : t("Check value")}</span> : null}</div>
      {name === "supplierAddress" ? <textarea id={id} value={value} rows={2} placeholder={placeholder} onChange={(event) => onChange(name, event.target.value)} onFocus={() => onFocus(name)} onBlur={() => onBlur(name)} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} /> : <input id={id} type={type} inputMode={isAmount ? "decimal" : undefined} value={value} placeholder={placeholder} required={required} autoComplete="off" spellCheck={false} onChange={(event) => onChange(name, event.target.value)} onFocus={() => onFocus(name)} onBlur={() => onBlur(name)} aria-invalid={invalid} aria-describedby={[needsCheck ? `${id}-review` : "", invalid ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined} />}
      {needsCheck ? <label className={`rv-field-check ${checked ? "rv-field-checked" : ""}`} id={`${id}-review`}><input type="checkbox" checked={checked} onChange={(event) => onCheck(name, event.target.checked)} /><span>{checked ? t("Checked against the original") : t("I checked this value against the original")}</span></label> : null}
      {invalid ? <p className="field-error" id={`${id}-error`}>{t(error ?? "")}</p> : null}
    </div>
  );
}

function historyTime(value: string, locale: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? `${date.toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC` : "Time unavailable";
}

function errorLabel(key: string, t: (text: string, values?: Record<string, string | number>) => string) {
  if (key.startsWith("lines.")) {
    const [, index, field] = key.split(".");
    return t("Line {number} · {field}", { number: Number(index) + 1, field: t(({ lineAmount: "Line amount", unitPrice: "Unit price", quantity: "Quantity", taxRate: "Tax rate (%)", taxAmount: "Tax amount", description: "Description", unitOfMeasure: "Unit of measure" } as Record<string, string>)[field] || field) });
  }
  return t(fieldLabels[key as HeaderField] || "Invoice");
}

export default function InvoiceReview({ item, draft, onDraftChange, onSave, onBack, onNext, hasNext, saving, mode, sourceUrl, runs, onAnalyze, analyzing, serverErrors, error }: Props) {
  const { t, formatLocale } = useLanguage();
  const [tab, setTab] = useState<Tab>("details");
  const [mobilePanel, setMobilePanel] = useState<"document" | "fields">("fields");
  const [activeField, setActiveField] = useState<HeaderField | null>("invoiceNumber");
  const [touched, setTouched] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const currentErrors = { ...validateDraft(draft, item, t), ...serverErrors };
  const issueKeys = Object.keys(currentErrors);
  const values = draft.values;
  const baseline = createDraft(item);
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline.values);
  const completed = item.latestRun?.status === "Completed";
  const runFailed = item.latestRun?.status === "Failed";
  const total = numericValue(values.totalAmount);
  const totalText = total === null ? "—" : new Intl.NumberFormat(formatLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total);

  function changeField(name: HeaderField, value: string) {
    setFeedback("");
    onDraftChange({ ...draft, values: { ...values, [name]: value }, checkedFields: draft.checkedFields.filter((field) => field !== name) });
  }

  function checkField(name: string, checked: boolean) {
    onDraftChange({ ...draft, checkedFields: checked ? [...new Set([...draft.checkedFields, name])] : draft.checkedFields.filter((field) => field !== name) });
  }

  function focusIssue(key: string) {
    setMobilePanel("fields");
    setTab(key.startsWith("lines.") ? "lines" : "details");
    if (!key.startsWith("lines.")) setActiveField(key as HeaderField);
    requestAnimationFrame(() => {
      const element = root.current?.querySelector<HTMLElement>(`[id="rv-field-${key}"]`);
      let ancestor = element?.parentElement;
      while (ancestor && ancestor !== root.current) {
        if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
        ancestor = ancestor.parentElement;
      }
      element?.focus();
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function focusNextIssue() {
    const currentIndex = activeField ? issueKeys.indexOf(activeField) : -1;
    focusIssue(issueKeys[(currentIndex + 1) % issueKeys.length]);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setFeedback("");
    if (issueKeys.length) {
      focusIssue(issueKeys[0]);
      return;
    }
    try {
      await onSave(draft);
      setFeedback(mode === "demo" ? "Invoice saved in your demo workspace." : "Invoice saved successfully.");
      setSubmitted(false);
    } catch {
      // The workspace owns transport errors and field errors so they remain visible here.
    }
  }

  function changeLine(index: number, field: keyof InvoiceLineDraft, value: string) {
    setFeedback("");
    onDraftChange({ ...draft, checkedFields: draft.checkedFields.filter((key) => key !== `${values.lines[index].id}.${field}`), values: { ...values, lines: values.lines.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line) } });
  }

  function renderLineField(line: InvoiceLineDraft, index: number, key: Exclude<keyof InvoiceLineDraft, "id">, label: string, wide = false) {
    const fieldKey = `lines.${index}.${key}`;
    const extracted = getExtractedLineField(item, line, key);
    const needsCheck = fieldNeedsCheck(extracted);
    const checkKey = lineCheckKey(line, key);
    const checked = draft.checkedFields.includes(checkKey);
    const error = currentErrors[fieldKey];
    const text = key === "description" || key === "unitOfMeasure";
    return <div className={`rv-field ${wide ? "rv-field-wide" : ""} ${needsCheck && !checked ? "rv-field-review" : ""}`} key={key}>
      <div className="rv-field-label"><label htmlFor={`rv-field-${fieldKey}`}>{label}</label>{needsCheck ? <span className={`rv-confidence ${checked ? "" : "rv-confidence-low"}`}>{checked ? t("Checked") : t("Check value")}</span> : null}</div>
      <input id={`rv-field-${fieldKey}`} inputMode={text ? "text" : "decimal"} value={line[key]} onChange={(event) => changeLine(index, key, event.target.value)} aria-invalid={Boolean(error)} aria-describedby={[needsCheck ? `rv-check-${fieldKey}` : "", error ? `rv-error-${fieldKey}` : ""].filter(Boolean).join(" ") || undefined} />
      {needsCheck ? <label className={`rv-field-check ${checked ? "rv-field-checked" : ""}`} id={`rv-check-${fieldKey}`}><input type="checkbox" checked={checked} onChange={(event) => checkField(checkKey, event.target.checked)} /><span>{checked ? t("Checked against the original") : t("I checked this value against the original")}</span></label> : null}
      {key === "lineAmount" && taxInclusiveLineNet(line) !== null ? <p className="rv-confidence-note">{t("Includes tax · Amount before tax:")} {taxInclusiveLineNet(line)!.toFixed(2)}.</p> : null}
      {error ? <p className="field-error" id={`rv-error-${fieldKey}`}>{t(error ?? "")}</p> : null}
    </div>;
  }

  function renderField(name: HeaderField, options: Partial<Pick<FieldProps, "wide" | "required" | "placeholder" | "type">> = {}) {
    return <InvoiceField key={name} name={name} value={values[name]} extracted={getExtractedField(item, name)} checked={draft.checkedFields.includes(name)} error={currentErrors[name]} showError={submitted || touched.includes(name) || Boolean(serverErrors[name])} onChange={changeField} onCheck={checkField} onFocus={setActiveField} onBlur={(field) => setTouched((previous) => previous.includes(field) ? previous : [...previous, field])} {...options} />;
  }

  return (
    <div className="rv-workspace" ref={root}>
      <div className="rv-breadcrumb"><button type="button" onClick={onBack}><ArrowLeft size={15} />{t("Documents")}</button><ChevronRight size={13} aria-hidden="true" /><span>{item.invoice ? t("Invoice details") : t("Review document")}</span></div>
      <header className="rv-heading"><div className="rv-heading-main"><div className="rv-file-icon"><FileText size={24} /></div><div><h1>{values.supplierName || item.document.originalFileName}</h1><p>{item.document.originalFileName}<span>·</span>{item.sample ? t("1 page") : item.document.contentType === "application/pdf" ? t("PDF document") : t("Image document")}{mode === "demo" ? <><span>·</span>{item.sample ? t("Sample data") : t("Stored in this browser")}</> : null}</p></div></div><div className="rv-heading-actions"><span className={`badge ${item.invoice && !dirty ? "badge-saved" : issueKeys.length ? "badge-review" : "badge-processing"}`}>{item.invoice && !dirty ? <CheckCheck size={13} /> : issueKeys.length ? <CircleAlert size={13} /> : <ShieldCheck size={13} />}{item.invoice && !dirty ? t("Invoice saved") : issueKeys.length ? t("Needs review") : t("Ready to save")}</span>{hasNext ? <button type="button" className="button button-ghost button-small" onClick={onNext} disabled={saving}>{t("Next document")}<ArrowRight size={15} /></button> : null}</div></header>

      <div className="rv-mobile-tabs" aria-label={t("Review panels")}><button type="button" aria-pressed={mobilePanel === "document"} onClick={() => setMobilePanel("document")}><FileText size={15} />{t("Original document")}</button><button type="button" aria-pressed={mobilePanel === "fields"} onClick={() => setMobilePanel("fields")}><Layers3 size={15} />{t("Invoice details")}{issueKeys.length ? <span>{issueKeys.length}</span> : null}</button></div>

      <div className={`rv-split rv-mobile-${mobilePanel}`}>
        <div className="rv-original-panel"><DocumentPreview key={item.document.id} item={item} sourceUrl={sourceUrl} activeField={activeField} onFieldSelect={focusIssue} /></div>
        <section className="rv-data-panel" aria-label={t("Invoice review form")}>
          <div className="rv-data-panel-header"><div><h2>{t("Invoice details")}</h2><p>{item.invoice ? t("Saved record · edit to make a correction") : t("Check the details before saving")}</p></div><span className="rv-extraction-icon"><ShieldCheck size={20} aria-hidden="true" /></span></div>
          <ProcessingProgress run={item.latestRun} submitting={analyzing} />
          <div className="rv-tablist" role="tablist" aria-label={t("Invoice information")}>{([{ id: "details", label: t("Details"), icon: FileText }, { id: "lines", label: t("Line items"), icon: Layers3 }, { id: "history", label: t("History"), icon: History }] as const).map(({ id, label, icon: Icon }) => <button type="button" role="tab" key={id} id={`rv-tab-${id}`} aria-selected={tab === id} aria-controls={`rv-panel-${id}`} onClick={() => setTab(id)} onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); const tabs: Tab[] = ["details", "lines", "history"]; const next = tabs[(tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 2)) % 3]; setTab(next); root.current?.querySelector<HTMLButtonElement>(`#rv-tab-${next}`)?.focus(); } }}><Icon size={14} aria-hidden="true" />{label}{id === "lines" && values.lines.length > 0 ? <span>{values.lines.length}</span> : null}</button>)}</div>

          <form noValidate onSubmit={save} className="rv-form">
            <fieldset disabled={saving} className="rv-fieldset">
              <div className="rv-form-content">
                {error ? <div className="rv-error-banner" role="alert"><CircleAlert size={17} /><div><strong>{t("We couldn’t complete that action")}</strong><p>{t(error)}</p></div></div> : null}
                {submitted && issueKeys.length ? <div className="rv-validation-summary" role="alert"><strong>{t("Check")} {issueKeys.length} {issueKeys.length === 1 ? t("item") : t("items")}  {t("before saving")}</strong><ul>{issueKeys.map((key) => <li key={key}><button type="button" onClick={() => focusIssue(key)}>{errorLabel(key, t)}: {t(currentErrors[key])}</button></li>)}</ul></div> : null}
                <section role="tabpanel" id="rv-panel-details" aria-labelledby="rv-tab-details" hidden={tab !== "details"}>
                  {analyzing && !dirty && !item.invoice ? null : issueKeys.length ? <div className="rv-issue-banner"><div className="rv-issue-banner-icon"><CircleAlert size={17} /></div><div><strong>{issueKeys.length} {issueKeys.length === 1 ? t("item needs") : t("items need")}  {t("your attention")}</strong><p>{t("Compare flagged values with the original.")}</p></div><button type="button" onClick={focusNextIssue} aria-label={t("Go to next issue")}><ArrowRight size={17} /></button></div> : <div className="rv-checked-banner"><CheckCheck size={17} /><span>{item.invoice && !dirty ? t("Invoice details saved") : t("All checks complete. Ready to save.")}</span></div>}
                  {!completed && !item.invoice && !analyzing ? <div className="rv-processing-note"><p>{mode === "demo" && !item.sample ? t("Enter the invoice details below. Automatic analysis is not available for uploads in the demo.") : runFailed ? t("We couldn’t read the document. Try again or enter the details yourself.") : t("Fill in the details automatically, or enter them yourself.")}</p>{mode === "live" || item.sample ? <button type="button" className="button button-small" onClick={onAnalyze}><RotateCw size={14} />{runFailed ? t("Try again") : t("Read document")}</button> : null}</div> : null}
                  <div className="rv-field-group"><div className="rv-group-heading"><span>{t("INVOICE DETAILS")}</span><span>{t("* Required")}</span></div><div className="rv-fields">{renderField("supplierName", { required: true, wide: true, placeholder: t("Supplier or company name") })}{renderField("invoiceNumber", { required: true, wide: true, placeholder: t("e.g. INV-2026-0137") })}{renderField("invoiceDate", { required: true, type: "date" })}{renderField("dueDate", { type: "date" })}</div></div>
                  <div className="rv-field-group"><div className="rv-group-heading"><span>{t("AMOUNTS")}</span><span>{t("Use a decimal point")}</span></div><div className="rv-fields">{renderField("subtotalAmount", { placeholder: "0.00" })}{renderField("taxAmount", { placeholder: "0.00" })}{renderField("shippingAmount", { placeholder: "0.00" })}{renderField("discountAmount", { placeholder: "0.00" })}{renderField("totalAmount", { required: true, placeholder: "0.00" })}{renderField("currency", { placeholder: t("e.g. EUR") })}</div></div>
                  <details className="rv-additional"><summary><span>{t("Additional details")}</span><span>{t("Optional")} <ChevronDown size={14} /></span></summary><div className="rv-fields">{renderField("purchaseOrderNumber", { wide: true, placeholder: t("Purchase order reference") })}{renderField("supplierTaxId", { wide: true, placeholder: t("Supplier tax registration") })}{renderField("supplierAddress", { wide: true, placeholder: t("Street, city, postal code and country") })}</div></details>
                  <p className="rv-confidence-note">{t("Enter shipping and discounts only if they are not already included in the subtotal. Leave them blank if they do not apply.")}</p>
                  <p className="rv-confidence-note"><ShieldCheck size={13} />{t("Check highlighted values against the original before saving.")}</p>
                </section>

                <section role="tabpanel" id="rv-panel-lines" aria-labelledby="rv-tab-lines" hidden={tab !== "lines"}>
                  <div className="rv-lines-heading"><div><h3>{t("Line items")}</h3></div><button type="button" className="button button-small" onClick={() => onDraftChange({ ...draft, values: { ...values, lines: [...values.lines, emptyLine(crypto.randomUUID())] } })}><Plus size={14} />{t("Add line")}</button></div>
                  {!values.lines.length ? <div className="rv-lines-empty"><div><Layers3 size={26} /></div><h3>{t("No line items yet")}</h3><p>{t("Add items from the original document.")}</p><button type="button" className="button" onClick={() => onDraftChange({ ...draft, values: { ...values, lines: [emptyLine(crypto.randomUUID())] } })}><Plus size={15} />{t("Add first line")}</button></div> : <div className="rv-lines-list">{values.lines.map((line, index) => <div className="rv-line" key={line.id}><div className="rv-line-heading"><span>{t("Item")} {index + 1}</span><button type="button" className="icon-button" onClick={() => onDraftChange({ ...draft, values: { ...values, lines: values.lines.filter((_, lineIndex) => lineIndex !== index) } })} aria-label={t("Remove line {number}", { number: index + 1 })}><Trash2 size={15} /></button></div><div className="rv-fields">{renderLineField(line, index, "description", t("Description"), true)}{renderLineField(line, index, "quantity", t("Quantity"))}{renderLineField(line, index, "unitPrice", t("Unit price"))}{renderLineField(line, index, "lineAmount", t("Line amount"), true)}</div><details className="rv-line-extra"><summary>{t("Tax and unit details")}</summary><div className="rv-fields">{renderLineField(line, index, "unitOfMeasure", t("Unit of measure"))}{renderLineField(line, index, "taxRate", t("Tax rate (%)"))}{renderLineField(line, index, "taxAmount", t("Tax amount"))}</div></details></div>)}</div>}
                  {values.lines.length ? <div className="rv-lines-total"><span>{t("Sum of line amounts")}</span><strong>{values.lines.reduce((sum, line) => sum + (numericValue(line.lineAmount) ?? 0), 0).toFixed(2)} {values.currency.toUpperCase()}</strong></div> : null}
                </section>

                <section role="tabpanel" id="rv-panel-history" aria-labelledby="rv-tab-history" hidden={tab !== "history"}>
                  <div className="rv-lines-heading"><div><h3>{t("Document history")}</h3></div>{!item.invoice ? <button type="button" className="button button-small" onClick={onAnalyze} disabled={analyzing}>{analyzing ? <LoaderCircle className="rv-spin" size={14} /> : <RotateCw size={14} />}{analyzing ? item.latestRun?.status === "Pending" ? t("Waiting…") : t("Reading…") : t("Run again")}</button> : null}</div>
                  <ol className="rv-history"><li><div className="rv-history-dot"><FileText size={14} /></div><div><div className="rv-history-title"><strong>{t("Document uploaded")}</strong><time>{t(historyTime(item.document.uploadedAt, formatLocale))}</time></div><p>{item.document.originalFileName}</p></div></li>{[...runs].sort((first, second) => first.startedAt.localeCompare(second.startedAt)).map((run) => <li key={run.id}><div className={`rv-history-dot ${run.status === "Failed" ? "rv-history-failed" : run.status === "Completed" ? "rv-history-complete" : ""}`}>{run.status === "Completed" ? <Check size={14} /> : run.status === "Failed" ? <CircleAlert size={14} /> : <Clock3 size={14} />}</div><div><div className="rv-history-title"><strong>{run.status === "Completed" ? t("Details ready") : t(analysisLabel(run))}</strong><time>{t(historyTime(run.completedAt || run.startedAt, formatLocale))}</time></div>{run.status === "Failed" ? <p className="rv-history-error">{t(analysisFailureMessage(run))}</p> : null}</div></li>)}{item.invoice ? <li><div className="rv-history-dot rv-history-complete"><Save size={14} /></div><div><div className="rv-history-title"><strong>{t("Invoice saved")}</strong><time>{t(historyTime(item.invoice.updatedAt, formatLocale))}</time></div><p>{t("Invoice")} {item.invoice.invoiceNumber}</p></div></li> : null}</ol>
                </section>
              </div>
              <footer className="rv-save-footer"><div className="rv-save-meta"><span>{t("INVOICE TOTAL")}</span><strong>{totalText} <small>{values.currency.toUpperCase()}</small></strong></div><div className="rv-save-actions"><span className={`rv-save-state ${feedback ? "rv-save-success" : ""}`} role="status">{saving ? t("Saving your invoice…") : feedback ? <><Check size={13} />{t(feedback)}</> : dirty ? t("Unsaved changes") : item.invoice ? t("All changes saved") : t("Not saved yet")}</span><button type="submit" className="button button-primary" disabled={saving || (Boolean(item.invoice) && !dirty)}>{saving ? <LoaderCircle size={15} className="rv-spin" /> : <Check size={15} />}{saving ? t("Saving…") : item.invoice ? t("Save changes") : t("Save invoice")}</button></div></footer>
            </fieldset>
          </form>
        </section>
      </div>
    </div>
  );
}
