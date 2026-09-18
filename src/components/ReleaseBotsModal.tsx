'use client';

import { useEffect, useState } from 'react';
import {
  AGENT_TAG,
  AgentRunCandidate,
  blocksDispatch,
  describeRepoReadiness,
  formatElapsed,
  isAgentReportOverdue,
  RepoAgentReadiness,
  repoKey,
  selectAgentRunCandidates,
} from '@/lib/agentRuns';
import { useNow } from '@/lib/useNow';
import { ALL_JOGS_ID, AGENT_MODELS, Epic, Ticket } from '@/lib/types';
import { XIcon } from './XIcon';

interface ReleaseBotsModalProps {
  jogId: string;
  tickets: Ticket[];
  epics: Epic[];
  jogs?: { id: string; name: string }[];
  onClose: () => void;
  onDispatched: () => void;
}

interface DispatchResult {
  dispatched: string[];
  failed: { key: string; error: string }[];
}

export function ReleaseBotsModal({ jogId, tickets, epics, jogs = [], onClose, onDispatched }: ReleaseBotsModalProps) {
  // Computed once on open, with the same function the server uses, so the list shown is what
  // gets dispatched (barring edits made elsewhere in between).
  const [selection] = useState(() => selectAgentRunCandidates(tickets, epics, jogId));
  const [backlogSelection] = useState(
    () => jogId !== ALL_JOGS_ID ? selectAgentRunCandidates(tickets, epics, ALL_JOGS_ID) : selection,
  );
  const [includeDispatched, setIncludeDispatched] = useState(false);
  const [includeBacklog, setIncludeBacklog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const toSend = [...selection.eligible, ...selection.alreadyDispatched];
    const backlogCandidates = [...backlogSelection.eligible, ...backlogSelection.alreadyDispatched];
    const backlogToAdd = backlogCandidates.filter((c) => !toSend.find((s) => s.ticket.id === c.ticket.id));
    return new Set([...toSend, ...backlogToAdd].map((c) => c.ticket.id));
  });
  // Pre-flight: which target repos can actually run a dispatch (see RepoAgentReadiness).
  // null while checking. A failed check leaves it empty rather than blocking — the dispatch
  // route re-checks and refuses unready repos itself.
  const [reposToCheck] = useState(() => [
    ...new Set(
      [...selection.eligible, ...selection.alreadyDispatched, ...backlogSelection.eligible, ...backlogSelection.alreadyDispatched].map(
        ({ repo }) => `${repo.owner}/${repo.name}`,
      ),
    ),
  ]);
  const [readiness, setReadiness] = useState<Record<string, RepoAgentReadiness> | null>(() =>
    reposToCheck.length === 0 ? {} : null,
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<DispatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reposToCheck.length === 0) return;
    const query = reposToCheck.map((repo) => `repo=${encodeURIComponent(repo)}`).join('&');
    let cancelled = false;
    fetch(`/api/agent-runs/repo-checks?${query}`)
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({}))
      .then((data: Record<string, RepoAgentReadiness>) => {
        if (!cancelled) setReadiness(data);
      });
    return () => {
      cancelled = true;
    };
  }, [reposToCheck]);

  const isBlocked = (candidate: AgentRunCandidate) => blocksDispatch(readiness?.[repoKey(candidate.repo)]);

  const toSend = includeDispatched ? [...selection.eligible, ...selection.alreadyDispatched] : selection.eligible;
  const backlogCandidates = includeDispatched
    ? [...backlogSelection.eligible, ...backlogSelection.alreadyDispatched]
    : backlogSelection.eligible;
  const backlogToAdd = includeBacklog ? backlogCandidates.filter((c) => !toSend.find((s) => s.ticket.id === c.ticket.id)) : [];
  const totalToSend = [...toSend, ...backlogToAdd];
  const sendable = totalToSend.filter((c) => !isBlocked(c));
  const selectedToSend = sendable.filter((c) => selectedIds.has(c.ticket.id));
  const checkingRepos = readiness === null;

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(sendable.map((c) => c.ticket.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleTicket = (ticketId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  };

  async function handleRelease() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch('/api/agent-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jogId,
          includeDispatched,
          includeBacklog,
          selectedIds: selectedToSend.map((c) => c.ticket.id),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(typeof data?.error === 'string' ? data.error : undefined);
      }
      const data: DispatchResult = await response.json();
      setResult(data);
      if (data.dispatched.length > 0) onDispatched();
    } catch (err) {
      setError((err instanceof Error && err.message) || 'Something went wrong dispatching agents.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          <XIcon className="h-5 w-5" />
        </button>
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Release the bots</h2>

        {result ? (
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <p>
              Dispatched {result.dispatched.length} agent{result.dispatched.length === 1 ? '' : 's'}
              {result.dispatched.length > 0 && `: ${result.dispatched.join(', ')}`}.
            </p>
            {result.failed.length > 0 && (
              <ul className="space-y-1 text-red-600 dark:text-red-400">
                {result.failed.map((failure) => (
                  <li key={failure.key}>
                    {failure.key}: {failure.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
              Todo and in-progress tickets tagged <code>{AGENT_TAG}</code>, in an epic with a GitHub repo.
            </p>
            {totalToSend.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No eligible tickets.</p>
            ) : (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="select-all"
                    checked={selectedToSend.length === sendable.length && sendable.length > 0}
                    disabled={sendable.length === 0}
                    onChange={(event) => handleToggleAll(event.target.checked)}
                    className="tt-checkbox"
                  />
                  <label htmlFor="select-all" className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedToSend.length === sendable.length && sendable.length > 0
                      ? `All ${sendable.length} selected`
                      : `Select all (${sendable.length})`}
                  </label>
                </div>
                <ul className="mb-3 space-y-1.5">
                  {totalToSend.map((candidate) => (
                    <CandidateRow
                      key={candidate.ticket.id}
                      candidate={candidate}
                      checked={!isBlocked(candidate) && selectedIds.has(candidate.ticket.id)}
                      onToggle={() => handleToggleTicket(candidate.ticket.id)}
                      setupProblem={describeRepoReadiness(candidate.repo, readiness?.[repoKey(candidate.repo)])}
                      isFromBacklog={jogId !== ALL_JOGS_ID && candidate.ticket.jogId !== jogId}
                      jogName={jogs.find((j) => j.id === candidate.ticket.jogId)?.name}
                    />
                  ))}
                </ul>
              </>
            )}
            {selection.alreadyDispatched.length > 0 && (
              <label className="mb-3 flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={includeDispatched}
                  onChange={(event) => setIncludeDispatched(event.target.checked)}
                  className="tt-checkbox"
                />
                Also re-dispatch {selection.alreadyDispatched.length} ticket
                {selection.alreadyDispatched.length === 1 ? '' : 's'} with an agent already running
              </label>
            )}
            {jogId !== ALL_JOGS_ID && backlogToAdd.length > 0 && (
              <label className="mb-3 flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={includeBacklog}
                  onChange={(event) => setIncludeBacklog(event.target.checked)}
                  className="tt-checkbox"
                />
                Attempt tasks from backlog as well ({backlogToAdd.length} ticket
                {backlogToAdd.length === 1 ? '' : 's'})
              </label>
            )}
            {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleRelease}
              disabled={sending || checkingRepos || selectedToSend.length === 0}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {sending ? 'Dispatching…' : checkingRepos ? 'Checking repos…' : `Dispatch ${selectedToSend.length}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CandidateRow({
  candidate: { ticket, repo },
  checked,
  onToggle,
  setupProblem,
  isFromBacklog,
  jogName,
}: {
  candidate: AgentRunCandidate;
  checked: boolean;
  onToggle: () => void;
  /** Why this ticket's repo can't run agents; its row can't be selected while set. */
  setupProblem: string | null;
  /** Whether this ticket is from the backlog (different jog). */
  isFromBacklog?: boolean;
  /** Name of the jog this ticket is from (for backlog tickets). */
  jogName?: string;
}) {
  const modelLabel = AGENT_MODELS.find((m) => m.value === ticket.agentModel)?.label ?? 'Default';
  const now = useNow();
  const overdue = now !== null && isAgentReportOverdue(ticket, now);
  return (
    <li
      className={`rounded-md border px-2.5 py-1.5 text-sm ${
        setupProblem ? 'border-red-200 dark:border-red-900/60' : 'border-gray-200 dark:border-gray-700'
      } ${isFromBacklog ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}
    >
      <label className={`flex items-baseline gap-2 ${setupProblem ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          disabled={Boolean(setupProblem)}
          className="tt-checkbox shrink-0"
        />
        <span className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">{ticket.key}</span>
        <span className="truncate text-gray-900 dark:text-gray-100">{ticket.title}</span>
        {isFromBacklog && <span className="shrink-0 rounded px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">{jogName ?? 'Backlog'}</span>}
      </label>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {repo.owner}/{repo.name} · {modelLabel}
        {overdue && (
          <span className="text-amber-700 dark:text-amber-400">
            {' '}
            · dispatched {formatElapsed(now - Date.parse(ticket.agentDispatchedAt!))} ago, no report
          </span>
        )}
      </div>
      {setupProblem && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{setupProblem}</p>}
    </li>
  );
}
