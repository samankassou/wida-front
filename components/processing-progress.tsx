import { Check, CircleAlert, Clock3, LoaderCircle } from "lucide-react";
import type { ProcessingRun } from "@/lib/types";
import { analysisDescription, analysisLabel } from "@/lib/processing";

export default function ProcessingProgress({ run, submitting }: { run: ProcessingRun | null; submitting: boolean }) {
  if (!run && !submitting) return null;
  const requesting = submitting && (!run || run.status === "Completed" || run.status === "Failed");
  const failed = !requesting && run?.status === "Failed";
  const step = requesting ? 0 : run?.status === "Pending" ? 1 : run?.status === "Running" || failed ? 2 : 3;
  const Icon = failed ? CircleAlert : step === 3 ? Check : step === 2 || requesting ? LoaderCircle : Clock3;
  return <section className={`processing-progress ${failed ? "has-error" : ""}`} aria-label="Document processing">
    <div className="processing-progress-heading" role="status"><Icon size={20} className={step === 2 && !failed || requesting ? "spin" : ""} /><div><strong>{requesting ? "Requesting analysis…" : analysisLabel(run!)}</strong><p>{requesting ? "Your original is saved. Waiting for confirmation that analysis has been accepted." : analysisDescription(run!)}</p></div></div>
    <ol className="processing-steps">{["Uploaded", "Queued", "Extracting", "Ready to review"].map((label, index) => <li key={label} className={index < step ? "is-complete" : index === step ? "is-current" : ""} aria-current={index === step ? "step" : undefined}><span>{index < step ? <Check size={12} /> : index + 1}</span>{failed && index === step ? "Needs attention" : label}</li>)}</ol>
  </section>;
}
