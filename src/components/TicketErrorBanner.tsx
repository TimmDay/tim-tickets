import { XIcon } from './XIcon';

/** Shown when a ticket change failed and was rolled back. */
export function TicketErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mb-3 flex shrink-0 items-start justify-between gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
      <p>Couldn’t save that change, so it was undone: {message}</p>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
