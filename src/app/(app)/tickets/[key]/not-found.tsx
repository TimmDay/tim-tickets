import Link from 'next/link';

export default function TicketNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Ticket not found</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        This link may be stale, or the ticket may have been deleted.
      </p>
      <Link
        href="/backlog"
        className="mt-2 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
      >
        Go to backlog
      </Link>
    </div>
  );
}
