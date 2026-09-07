"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCheck, ChevronDown, ChevronRight, CircleAlert, Clock3, FileText, History, Layers3, LoaderCircle, Plus, RotateCw, Save, ShieldCheck, Trash2 } from "lucide-react";
import DocumentPreview from "./document-preview";
import { createDraft, emptyLine, fieldLabels, fieldNeedsCheck, getExtractedCurrency, getExtractedField, numericValue, validateDraft, type HeaderField } from "@/lib/invoice-form";
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
  origin?: string;
  extracted?: ExtractedField;
  checked: boolean;
  error?: string;
  showError: boolean;
  onChange: (name: HeaderField, value: string) => void;
  onCheck: (name: HeaderField, checked: boolean) => void;
  onFocus: (name: HeaderField) => void;
  onBlur: (name: HeaderField) => void;
}

function InvoiceField({ name, value, type = "text", required, placeholder, wide, origin, extracted, checked, error, showError, onChange, onCheck, onFocus, onBlur }: FieldProps) {
  const needsCheck = fieldNeedsCheck(extracted);
  const isAmount = name.endsWith("Amount");
  const manual = ["currency", "supplierAddress", "supplierTaxId", "purchaseOrderNumber"].includes(name);
  const id = `rv-field-${name}`;
  const invalid = Boolean(error && showError);
  const confidence = extracted?.confidence == null ? null : Math.round(extracted.confidence * 100);
  return (
    <div className={`rv-field ${wide ? "rv-field-wide" : ""} ${needsCheck && !checked ? "rv-field-review" : ""} ${invalid ? "rv-field-invalid" : ""}`}>
      <div className="rv-field-label"><label htmlFor={id}>{fieldLabels[name]}{required ? <span aria-hidden="true"> *</span> : null}</label>{extracted ? <span className={`rv-confidence ${needsCheck && !checked ? "rv-confidence-low" : ""}`} aria-label={confidence === null ? "Extraction confidence unavailable" : `Original extraction confidence ${confidence} percent`}>{checked && needsCheck ? <Check size={12} aria-hidden="true" /> : needsCheck ? <CircleAlert size={12} aria-hidden="true" /> : null}{confidence === null ? "Check value" : `${confidence}%`}</span> : <span className="rv-field-origin">{origin || (manual ? "Optional · manual" : value ? "Manual" : required ? "Not extracted" : "Optional")}</span>}</div>
      {name === "supplierAddress" ? <textarea id={id} value={value} rows={2} placeholder={placeholder} onChange={(event) => onChange(name, event.target.value)} onFocus={() => onFocus(name)} onBlur={() => onBlur(name)} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} /> : <input id={id} type={type} inputMode={isAmount ? "decimal" : undefined} value={value} placeholder={placeholder} required={required} autoComplete="off" spellCheck={false} onChange={(event) => onChange(name, event.target.value)} onFocus={() => onFocus(name)} onBlur={() => onBlur(name)} aria-invalid={invalid} aria-describedby={[needsCheck ? `${id}-review` : "", invalid ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined} />}
      {needsCheck ? <label className={`rv-field-check ${checked ? "rv-field-checked" : ""}`} id={`${id}-review`}><input type="checkbox" checked={checked} onChange={(event) => onCheck(name, event.target.checked)} /><span>{checked ? "Checked against the original" : "I checked this value against the original"}</span></label> : null}
      {invalid ? <p className="field-error" id={`${id}-error`}>{error}</p> : null}
    </div>
  );
}

function historyTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? `${date.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC` : "Time unavailable";
}

function errorLabel(key: string) {
  if (key.startsWith("lines.")) {
    const [, index, field] = key.split(".");
    return `Line ${Number(index) + 1} · ${field === "lineAmount" ? "amount" : field === "unitPrice" ? "unit price" : field}`;
  }
  return fieldLabels[key as HeaderField] || "Invoice";
}

export default function InvoiceReview({ item, draft, onDraftChange, onSave, onBack, onNext, hasNext, saving, mode, sourceUrl, runs, onAnalyze, analyzing, serverErrors, error }: Props) {
  const [tab, setTab] = useState<Tab>("details");
  const [mobilePanel, setMobilePanel] = useState<"document" | "fields">("fields");
  const [activeField, setActiveField] = useState<HeaderField | null>("invoiceNumber");
  const [touched, setTouched] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const currentErrors = { ...validateDraft(draft, item), ...serverErrors };
  const issueKeys = Object.keys(currentErrors);
  const values = draft.values;
  const baseline = createDraft(item);
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline.values);
  const completed = item.latestRun?.status === "Completed";
  const runFailed = item.latestRun?.status === "Failed";
  const total = numericValue(values.totalAmount);
  const totalText = total === null ? "—" : new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total);

  function changeField(name: HeaderField, value: string) {
    setFeedback("");
    onDraftChange({ values: { ...values, [name]: value }, checkedFields: draft.checkedFields.filter((field) => field !== name) });
  }

  function checkField(name: HeaderField, checked: boolean) {
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
    onDraftChange({ ...draft, values: { ...values, lines: values.lines.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line) } });
  }

  function renderField(name: HeaderField, options: Partial<Pick<FieldProps, "wide" | "required" | "placeholder" | "type">> = {}) {
    const extractedCurrency = name === "currency" ? getExtractedCurrency(item) : "";
    return <InvoiceField key={name} name={name} value={values[name]} origin={extractedCurrency && values.currency.trim().toUpperCase() === extractedCurrency ? "From invoice total" : undefined} extracted={getExtractedField(item, name)} checked={draft.checkedFields.includes(name)} error={currentErrors[name]} showError={submitted || touched.includes(name) || Boolean(serverErrors[name])} onChange={changeField} onCheck={checkField} onFocus={setActiveField} onBlur={(field) => setTouched((previous) => previous.includes(field) ? previous : [...previous, field])} {...options} />;
  }

  return (
    <div className="rv-workspace" ref={root}>
      <div className="rv-breadcrumb"><button type="button" onClick={onBack}><ArrowLeft size={15} />Documents</button><ChevronRight size={13} aria-hidden="true" /><span>{item.invoice ? "Invoice details" : "Review document"}</span></div>
      <header className="rv-heading"><div className="rv-heading-main"><div className="rv-file-icon"><FileText size={24} /></div><div><h1>{values.supplierName || item.document.originalFileName}</h1><p>{item.document.originalFileName}<span>·</span>{item.sample ? "1 page" : item.document.contentType === "application/pdf" ? "PDF document" : "Image document"}{mode === "demo" ? <><span>·</span>{item.sample ? "Sample data" : "Stored in this browser"}</> : null}</p></div></div><div className="rv-heading-actions"><span className={`badge ${item.invoice && !dirty ? "badge-saved" : issueKeys.length ? "badge-review" : "badge-processing"}`}>{item.invoice && !dirty ? <CheckCheck size={13} /> : issueKeys.length ? <CircleAlert size={13} /> : <ShieldCheck size={13} />}{item.invoice && !dirty ? "Invoice saved" : issueKeys.length ? "Needs review" : "Ready to save"}</span>{hasNext ? <button type="button" className="button button-ghost button-small" onClick={onNext} disabled={saving}>Next document<ArrowRight size={15} /></button> : null}</div></header>

      <div className="rv-mobile-tabs" aria-label="Review panels"><button type="button" aria-pressed={mobilePanel === "document"} onClick={() => setMobilePanel("document")}><FileText size={15} />Original document</button><button type="button" aria-pressed={mobilePanel === "fields"} onClick={() => setMobilePanel("fields")}><Layers3 size={15} />Invoice data{issueKeys.length ? <span>{issueKeys.length}</span> : null}</button></div>

      <div className={`rv-split rv-mobile-${mobilePanel}`}>
        <div className="rv-original-panel"><DocumentPreview key={item.document.id} item={item} sourceUrl={sourceUrl} activeField={activeField} onFieldSelect={focusIssue} /></div>
        <section className="rv-data-panel" aria-label="Invoice review form">
          <div className="rv-data-panel-header"><div><h2>Invoice data</h2><p>{item.invoice ? "Saved record · edit to make a correction" : "Review the extraction before saving"}</p></div><span className="rv-extraction-icon"><ScanExtractionIcon /></span></div>
          <div className="rv-tablist" role="tablist" aria-label="Invoice information">{([{ id: "details", label: "Details", icon: FileText }, { id: "lines", label: "Line items", icon: Layers3 }, { id: "history", label: "History", icon: History }] as const).map(({ id, label, icon: Icon }) => <button type="button" role="tab" key={id} id={`rv-tab-${id}`} aria-selected={tab === id} aria-controls={`rv-panel-${id}`} onClick={() => setTab(id)} onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); const tabs: Tab[] = ["details", "lines", "history"]; const next = tabs[(tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 2)) % 3]; setTab(next); root.current?.querySelector<HTMLButtonElement>(`#rv-tab-${next}`)?.focus(); } }}><Icon size={14} aria-hidden="true" />{label}{id === "lines" && values.lines.length > 0 ? <span>{values.lines.length}</span> : null}</button>)}</div>

          <form noValidate onSubmit={save} className="rv-form">
            <fieldset disabled={saving} className="rv-fieldset">
              <div className="rv-form-content">
                {error ? <div className="rv-error-banner" role="alert"><CircleAlert size={17} /><div><strong>We couldn’t complete that action</strong><p>{error}</p></div></div> : null}
                {submitted && issueKeys.length ? <div className="rv-validation-summary" role="alert"><strong>Check {issueKeys.length} {issueKeys.length === 1 ? "item" : "items"} before saving</strong><ul>{issueKeys.map((key) => <li key={key}><button type="button" onClick={() => focusIssue(key)}>{errorLabel(key)}: {currentErrors[key]}</button></li>)}</ul></div> : null}
                <section role="tabpanel" id="rv-panel-details" aria-labelledby="rv-tab-details" hidden={tab !== "details"}>
                  {issueKeys.length ? <div className="rv-issue-banner"><div className="rv-issue-banner-icon"><CircleAlert size={17} /></div><div><strong>{issueKeys.length} {issueKeys.length === 1 ? "item needs" : "items need"} your attention</strong><p>Compare flagged values with the original.</p></div><button type="button" onClick={focusNextIssue} aria-label="Go to next issue"><ArrowRight size={17} /></button></div> : <div className="rv-checked-banner"><CheckCheck size={17} /><span>{item.invoice && !dirty ? "Invoice data saved" : "All checks complete. Ready to save."}</span></div>}
                  {!completed && !item.invoice ? <div className="rv-processing-note"><p>{mode === "demo" && !item.sample ? "This original is stored in your browser. Enter the invoice details below; automatic extraction is available with a connected API." : analyzing ? "Extraction is running. You can review the source while it finishes." : runFailed ? "Extraction failed. Try again, or enter the invoice details manually." : "Run extraction to fill the invoice fields, or enter them manually."}</p>{mode === "live" || item.sample ? <button type="button" className="button button-small" onClick={onAnalyze} disabled={analyzing}>{analyzing ? <LoaderCircle size={14} className="rv-spin" /> : <RotateCw size={14} />}{analyzing ? "Extracting…" : runFailed ? "Retry extraction" : "Run extraction"}</button> : null}</div> : null}
                  <div className="rv-field-group"><div className="rv-group-heading"><span>INVOICE DETAILS</span><span>* Required</span></div><div className="rv-fields">{renderField("supplierName", { required: true, wide: true, placeholder: "Supplier or company name" })}{renderField("invoiceNumber", { required: true, wide: true, placeholder: "e.g. INV-2026-0137" })}{renderField("invoiceDate", { required: true, type: "date" })}{renderField("dueDate", { type: "date" })}</div></div>
                  <div className="rv-field-group"><div className="rv-group-heading"><span>AMOUNTS</span><span>Use a decimal point</span></div><div className="rv-fields">{renderField("subtotalAmount", { placeholder: "0.00" })}{renderField("taxAmount", { placeholder: "0.00" })}{renderField("totalAmount", { required: true, placeholder: "0.00" })}{renderField("currency", { placeholder: "e.g. EUR" })}</div></div>
                  <details className="rv-additional"><summary><span>Additional details</span><span>Optional <ChevronDown size={14} /></span></summary><div className="rv-fields">{renderField("purchaseOrderNumber", { wide: true, placeholder: "Purchase order reference" })}{renderField("supplierTaxId", { wide: true, placeholder: "Supplier tax registration" })}{renderField("supplierAddress", { wide: true, placeholder: "Street, city, postal code and country" })}</div></details>
                  <p className="rv-confidence-note"><ShieldCheck size={13} />Percentages show the original extraction confidence. A checked value records your review in this workspace.</p>
                </section>

                <section role="tabpanel" id="rv-panel-lines" aria-labelledby="rv-tab-lines" hidden={tab !== "lines"}>
                  <div className="rv-lines-heading"><div><h3>Line items</h3><p>Add items manually from the original.</p></div><button type="button" className="button button-small" onClick={() => onDraftChange({ ...draft, values: { ...values, lines: [...values.lines, emptyLine(crypto.randomUUID())] } })}><Plus size={14} />Add line</button></div>
                  {!values.lines.length ? <div className="rv-lines-empty"><div><Layers3 size={26} /></div><h3>No line items yet</h3><p>Line items are optional and aren’t extracted automatically. Add them when you need a detailed invoice record.</p><button type="button" className="button" onClick={() => onDraftChange({ ...draft, values: { ...values, lines: [emptyLine(crypto.randomUUID())] } })}><Plus size={15} />Add first line</button></div> : <div className="rv-lines-list">{values.lines.map((line, index) => <div className="rv-line" key={line.id}><div className="rv-line-heading"><span>Item {index + 1}</span><button type="button" className="icon-button" onClick={() => onDraftChange({ ...draft, values: { ...values, lines: values.lines.filter((_, lineIndex) => lineIndex !== index) } })} aria-label={`Remove line ${index + 1}`}><Trash2 size={15} /></button></div><div className="rv-fields">{([{ key: "description", label: "Description", wide: true }, { key: "quantity", label: "Quantity" }, { key: "unitPrice", label: "Unit price" }, { key: "lineAmount", label: "Line amount", wide: true }] as const).map(({ key, label, ...options }) => { const fieldKey = `lines.${index}.${key}`; return <div className={`rv-field ${"wide" in options && options.wide ? "rv-field-wide" : ""}`} key={key}><label htmlFor={`rv-field-${fieldKey}`}>{label}</label><input id={`rv-field-${fieldKey}`} inputMode={key === "description" ? "text" : "decimal"} value={line[key]} placeholder={key === "description" ? "Product or service" : "0.00"} onChange={(event) => changeLine(index, key, event.target.value)} aria-invalid={Boolean(currentErrors[fieldKey])} aria-describedby={currentErrors[fieldKey] ? `rv-error-${fieldKey}` : undefined} />{currentErrors[fieldKey] ? <p className="field-error" id={`rv-error-${fieldKey}`}>{currentErrors[fieldKey]}</p> : null}</div>; })}</div><details className="rv-line-extra"><summary>Tax and unit details</summary><div className="rv-fields">{([{ key: "unitOfMeasure", label: "Unit of measure" }, { key: "taxRate", label: "Tax rate (%)" }, { key: "taxAmount", label: "Tax amount" }] as const).map(({ key, label }) => { const fieldKey = `lines.${index}.${key}`; return <div className="rv-field" key={key}><label htmlFor={`rv-field-${fieldKey}`}>{label}</label><input id={`rv-field-${fieldKey}`} value={line[key]} inputMode={key === "unitOfMeasure" ? "text" : "decimal"} onChange={(event) => changeLine(index, key, event.target.value)} aria-invalid={Boolean(currentErrors[fieldKey])} aria-describedby={currentErrors[fieldKey] ? `rv-error-${fieldKey}` : undefined} />{currentErrors[fieldKey] ? <p className="field-error" id={`rv-error-${fieldKey}`}>{currentErrors[fieldKey]}</p> : null}</div>; })}</div></details></div>)}</div>}
                  {values.lines.length ? <div className="rv-lines-total"><span>Sum of line amounts</span><strong>{values.lines.reduce((sum, line) => sum + (numericValue(line.lineAmount) ?? 0), 0).toFixed(2)} {values.currency.toUpperCase()}</strong></div> : null}
                </section>

                <section role="tabpanel" id="rv-panel-history" aria-labelledby="rv-tab-history" hidden={tab !== "history"}>
                  <div className="rv-lines-heading"><div><h3>Processing history</h3><p>Extraction runs for this document.</p></div>{!item.invoice ? <button type="button" className="button button-small" onClick={onAnalyze} disabled={analyzing}>{analyzing ? <LoaderCircle className="rv-spin" size={14} /> : <RotateCw size={14} />}{analyzing ? "Running…" : "Run again"}</button> : null}</div>
                  <ol className="rv-history"><li><div className="rv-history-dot"><FileText size={14} /></div><div><div className="rv-history-title"><strong>Document uploaded</strong><time>{historyTime(item.document.uploadedAt)}</time></div><p>{item.document.originalFileName}</p></div></li>{[...runs].sort((first, second) => first.startedAt.localeCompare(second.startedAt)).map((run) => <li key={run.id}><div className={`rv-history-dot ${run.status === "Failed" ? "rv-history-failed" : run.status === "Completed" ? "rv-history-complete" : ""}`}>{run.status === "Completed" ? <Check size={14} /> : run.status === "Failed" ? <CircleAlert size={14} /> : <Clock3 size={14} />}</div><div><div className="rv-history-title"><strong>{run.status === "Completed" ? "Extraction completed" : run.status === "Failed" ? "Extraction failed" : "Extraction in progress"}</strong><time>{historyTime(run.completedAt || run.startedAt)}</time></div><p>{run.processor}{run.processorVersion ? ` · ${run.processorVersion}` : ""}{run.status === "Completed" ? ` · ${run.extractedFields.length} fields returned` : ""}</p>{run.errorMessage ? <p className="rv-history-error">{run.errorMessage}</p> : null}{run.errorCode ? <span className="rv-error-code">{run.errorCode}</span> : null}</div></li>)}{item.invoice ? <li><div className="rv-history-dot rv-history-complete"><Save size={14} /></div><div><div className="rv-history-title"><strong>Invoice saved</strong><time>{historyTime(item.invoice.updatedAt)}</time></div><p>Invoice {item.invoice.invoiceNumber}</p></div></li> : null}</ol>
                </section>
              </div>
              <footer className="rv-save-footer"><div className="rv-save-meta"><span>INVOICE TOTAL</span><strong>{totalText} <small>{values.currency.toUpperCase()}</small></strong></div><div className="rv-save-actions"><span className={`rv-save-state ${feedback ? "rv-save-success" : ""}`} role="status">{saving ? "Saving your invoice…" : feedback ? <><Check size={13} />{feedback}</> : dirty ? "Unsaved changes" : item.invoice ? "All changes saved" : "Not saved yet"}</span><button type="submit" className="button button-primary" disabled={saving || (Boolean(item.invoice) && !dirty)}>{saving ? <LoaderCircle size={15} className="rv-spin" /> : <Check size={15} />}{saving ? "Saving…" : item.invoice ? "Save changes" : "Save invoice"}</button></div></footer>
            </fieldset>
          </form>
        </section>
      </div>
    </div>
  );
}

function ScanExtractionIcon() {
  return <ShieldCheck size={20} aria-hidden="true" />;
}
