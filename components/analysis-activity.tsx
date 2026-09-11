import { ArrowRight, CheckCircle2, CircleAlert, Clock3, LoaderCircle } from "lucide-react";
import type { ProcessingRun, WorkspaceItem } from "@/lib/types";
import { analysisLabel } from "@/lib/processing";

interface Props {
  items: WorkspaceItem[];
  activeItems: WorkspaceItem[];
  recentUpdates: ProcessingRun[];
  statusUnavailable: boolean;
  onOpen: (id: string) => void;
  onDismiss: () => void;
}

export default function AnalysisActivity({ items, activeItems, recentUpdates, statusUnavailable, onOpen, onDismiss }: Props) {
  if (!activeItems.length && !recentUpdates.length) return null;
  return <section className="processing-activity" aria-label="Analysis activity">
        <div className="processing-activity-heading"><div><strong>Document activity</strong><p>{activeItems.length ? `${activeItems.length} ${activeItems.length === 1 ? "analysis" : "analyses"} in progress · You can keep working` : "Your latest analysis results"}</p></div>{recentUpdates.length ? <button className="button button-small" onClick={() => onDismiss()}>Dismiss updates</button> : null}</div>
        {statusUnavailable && activeItems.length > 0 ? <p className="processing-connection" role="status">Status updates are delayed. We’re reconnecting automatically. Your documents and edits are safe; don’t submit them again.</p> : null}
        <ul>{[...activeItems.map(row => row.latestRun!), ...recentUpdates].map(run => <li key={run.id}><button onClick={() => onOpen(run.documentId)}><span>{run.status === "Pending" ? <Clock3 size={17} /> : run.status === "Running" ? <LoaderCircle size={17} className="spin" /> : run.status === "Completed" ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}<strong>{items.find(row => row.document.id === run.documentId)?.document.originalFileName}</strong></span><span>{analysisLabel(run)}<ArrowRight size={15} /></span></button></li>)}</ul>
      </section>;
}
