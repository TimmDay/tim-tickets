'use client';

import { useState } from 'react';
import { AgentRunCandidate, selectAgentRunCandidates } from '@/lib/agentRuns';
import { AGENT_MODELS, Epic, Ticket } from '@/lib/types';
import { XIcon } from './XIcon';

interface ReleaseBotsModalProps {
  jogId: string;
  tickets: Ticket[];
  epics: Epic[];
  onClose: () => void;
  onDispatched: () => void;
}

interface DispatchResult {
  dispatched: string[];
  failed: { key: string; error: string }[];
}

export function ReleaseBotsModal({ jogId, tickets, epics, onClose, onDispatched }: ReleaseBotsModalProps) {
  // Computed once on open, with the same function the server uses, so the list shown is what
  // gets dispatched (barring edits made elsewhere in between).
  const [selection] = useState(() => selectAgentRunCandidates(tickets, epics, jogId));
  const [includeDispatched, setIncludeDispatched] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<DispatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toSend = includeDispatched ? [...selection.eligible, ...selection.alreadyDispatched] : selection.eligible;

  async function handleRelease() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch('/api/agent-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jogId, includeDispatched }),
      });
      if (!response.ok) throw new Error();
      const data: DispatchResult = await response.json();
      setResult(data);
      if (data.dispatched.length > 0) onDispatched();
    } catch {
      setError('Something went wrong dispatching agents.');
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
              Todo and in-progress tickets tagged <code>dev</code>, in an epic with a GitHub repo.
            </p>
            {toSend.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No eligible tickets.</p>
            ) : (
              <ul className="mb-3 space-y-1.5">
                {toSend.map((candidate) => (
                  <CandidateRow key={candidate.ticket.id} candidate={candidate} />
                ))}
              </ul>
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
              disabled={sending || toSend.length === 0}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {sending ? 'Dispatching…' : `Dispatch ${toSend.length}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CandidateRow({ candidate: { ticket, repo } }: { candidate: AgentRunCandidate }) {
  const modelLabel = AGENT_MODELS.find((m) => m.value === ticket.agentModel)?.label ?? 'Default';
  return (
    <li className="rounded-md border border-gray-200 px-2.5 py-1.5 text-sm dark:border-gray-700">
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">{ticket.key}</span>
        <span className="truncate text-gray-900 dark:text-gray-100">{ticket.title}</span>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {repo.owner}/{repo.name} · {modelLabel}
      </div>
    </li>
  );
}
