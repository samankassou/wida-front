"use client";

import { useCallback, useState } from "react";
import { loadDraft, removeDraft, saveDraft } from "@/lib/storage";
import type { ReviewDraft, WorkspaceItem, WorkspaceMode } from "@/lib/types";

export function useReviewDrafts(mode: WorkspaceMode, userId?: string) {
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  const restoreDraft = useCallback((id: string) => {
    const restored = loadDraft(id, mode, userId);
    if (restored) setDrafts(previous => previous[id] ? previous : { ...previous, [id]: restored });
  }, [mode, userId]);

  function storeDraft(item: WorkspaceItem, draft: ReviewDraft) {
    const id = item.document.id;
    const edited = { ...draft, extractionRunId: item.latestRun?.id ?? null };
    setDrafts(previous => ({ ...previous, [id]: edited }));
    const persisted = saveDraft(id, mode, edited, userId);
    setFailed(previous => {
      const next = new Set(previous);
      if (persisted) next.delete(id); else next.add(id);
      return next;
    });
  }

  function discardDraft(id: string) {
    removeDraft(id, mode, userId);
    setDrafts(previous => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setFailed(previous => {
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  }

  return { drafts, restoreDraft, storeDraft, discardDraft, hasFailedDrafts: failed.size > 0 };
}
