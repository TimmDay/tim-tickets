// In-memory (not localStorage/sessionStorage) so a draft survives an accidental modal dismissal
// but is naturally gone on a real browser refresh, matching what was asked for: persist until
// saved, cancelled, or the page reloads.
const drafts = new Map<string, unknown>();

export function getDraft<T>(key: string): T | undefined {
  return drafts.get(key) as T | undefined;
}

export function setDraft<T>(key: string, value: T): void {
  drafts.set(key, value);
}

export function clearDraft(key: string): void {
  drafts.delete(key);
}
