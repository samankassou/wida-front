
import { useLanguage } from "./language-provider";
import { Check, CircleAlert, Clock3, LoaderCircle } from "lucide-react";
import type { ProcessingRun } from "@/lib/types";
import { analysisDescription, analysisLabel } from "@/lib/processing";

export default function ProcessingProgress({ run, submitting }: { run: ProcessingRun | null; submitting: boolean }) {
  const { t } = useLanguage();
  if (!run && !submitting) return null;
  const requesting = submitting && (!run || run.status === "Completed" || run.status === "Failed");
  const failed = !requesting && run?.status === "Failed";
  const step = requesting ? 0 : run?.status === "Pending" ? 1 : run?.status === "Running" || failed ? 2 : 3;
  const Icon = failed ? CircleAlert : step === 3 ? Check : step === 2 || requesting ? LoaderCircle : Clock3;
  return <section className={`processing-progress ${failed ? "has-error" : ""}`} aria-label={t("Document processing")}>
    <div className="processing-progress-heading" role="status"><Icon size={20} className={step === 2 && !failed || requesting ? "spin" : ""} /><div><strong>{requesting ? t("Starting analysis…") : t(analysisLabel(run!))}</strong><p>{requesting ? t("Your document is saved. You can keep working.") : t(analysisDescription(run!))}</p></div></div>
    <ol className="processing-steps">{[t("Uploaded"), t("Waiting"), t("Reading"), t("Ready to review")].map((label, index) => <li key={label} className={index < step ? "is-complete" : index === step ? "is-current" : ""} aria-current={index === step ? "step" : undefined}><span>{index < step ? <Check size={12} /> : index + 1}</span>{failed && index === step ? t("Needs attention") : t(label)}</li>)}</ol>
  </section>;
}
