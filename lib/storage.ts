import type { ReviewDraft, WorkspaceItem, WorkspaceMode } from "./types";

const WORKSPACE_KEY = "wida:demo:v2";
const liveDraftPrefix = (userId: string) => `wida:live-draft:v2:${encodeURIComponent(userId)}:`;
const draftKey = (id: string, mode: WorkspaceMode, userId?: string) => {
  if (mode === "demo") return `wida:draft:v1:${id}`;
  if (!userId) throw new Error("A signed-in user is required to store live drafts.");
  return `${liveDraftPrefix(userId)}${encodeURIComponent(id)}`;
};
const draftStore = (mode: WorkspaceMode) => mode === "demo" ? localStorage : sessionStorage;

export function loadWorkspace(): WorkspaceItem[] | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(WORKSPACE_KEY) || "null");
    return Array.isArray(value) && value.every(item => item?.document?.id && item.document.originalFileName && "invoice" in item && "latestRun" in item) ? value : null;
  } catch { return null; }
}

export function saveWorkspace(items: WorkspaceItem[]) {
  try { localStorage.setItem(WORKSPACE_KEY, JSON.stringify(items)); return true; } catch { return false; }
}

export function loadDraft(id: string, mode: WorkspaceMode, userId?: string): ReviewDraft | null {
  try {
    const value = JSON.parse(draftStore(mode).getItem(draftKey(id, mode, userId)) || "null");
    return value?.values && typeof value.values.supplierName === "string" && Array.isArray(value.values.lines) && Array.isArray(value.checkedFields) ? value : null;
  } catch { return null; }
}

export function saveDraft(id: string, mode: WorkspaceMode, draft: ReviewDraft, userId?: string) {
  try { draftStore(mode).setItem(draftKey(id, mode, userId), JSON.stringify(draft)); return true; } catch { return false; }
}

export function removeDraft(id: string, mode: WorkspaceMode, userId?: string) {
  try { draftStore(mode).removeItem(draftKey(id, mode, userId)); } catch { /* In-memory state remains usable. */ }
}

export function hasLiveDrafts(userId: string): boolean {
  try { return Object.keys(sessionStorage).some(key => key.startsWith(liveDraftPrefix(userId))); }
  catch { return false; }
}

export function clearLiveDrafts(userId: string): void {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(liveDraftPrefix(userId))) sessionStorage.removeItem(key);
  } catch { /* The session gate still removes the workspace from memory. */ }
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("wida-local-files", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("documents");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("This browser could not open local document storage."));
  });
}

export async function putDocumentFile(id: string, file: Blob): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("documents", "readwrite");
    transaction.objectStore("documents").put(file, id);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(new Error("The document could not be saved in this browser. Check available storage and try again.")); };
    transaction.onabort = transaction.onerror;
  });
}

export async function getDocumentFile(id: string): Promise<Blob | null> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("documents");
    const request = transaction.objectStore("documents").get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(new Error("The original file could not be loaded."));
    transaction.oncomplete = () => db.close();
  });
}
