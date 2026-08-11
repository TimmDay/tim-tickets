'use client';

import { useMemo, useState } from 'react';
import { useJogs } from '@/lib/JogsContext';
import { JogSelect } from './JogSelect';
import { TicketModal } from './TicketModal';
import { STATUSES, Ticket } from '@/lib/types';

type SortKey = 'title' | 'jog' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export function BacklogTable({ initialTickets }: { initialTickets: Ticket[] }) {
  const { jogs } = useJogs();
  const [tickets, setTickets] = useState(initialTickets);
  const [search, setSearch] = useState('');
  const [jogFilter, setJogFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

  const jogNameById = useMemo(() => new Map(jogs.map((jog) => [jog.id, jog.name])), [jogs]);
  const statusLabelByValue = useMemo(() => new Map(STATUSES.map((s) => [s.value, s.label])), []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  }

  const visibleTickets = useMemo(() => {
    let result = tickets;

    if (search.trim()) {
      const query = search.trim().toLowerCase();
      result = result.filter((ticket) => ticket.title.toLowerCase().includes(query));
    }

    if (jogFilter !== 'all') {
      result = result.filter((ticket) => ticket.jogId === jogFilter);
    }

    const direction = sortDirection === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      if (sortKey === 'title') return a.title.localeCompare(b.title) * direction;
      if (sortKey === 'jog') {
        const nameA = jogNameById.get(a.jogId) ?? '';
        const nameB = jogNameById.get(b.jogId) ?? '';
        return nameA.localeCompare(nameB) * direction;
      }
      return a.createdAt.localeCompare(b.createdAt) * direction;
    });

    return result;
  }, [tickets, search, jogFilter, sortKey, sortDirection, jogNameById]);

  async function handleReassign(ticketId: string, jogId: string) {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, jogId } : t)));
    await fetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jogId }),
    });
  }

  function handleSaved(ticket: Ticket) {
    setTickets((prev) =>
      prev.some((t) => t.id === ticket.id) ? prev.map((t) => (t.id === ticket.id ? ticket : t)) : [...prev, ticket],
    );
  }

  function handleDeleted(ticketId: string) {
    setTickets((prev) => prev.filter((t) => t.id !== ticketId));
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title…"
          className="w-64 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <select
          value={jogFilter}
          onChange={(event) => setJogFilter(event.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="all">All jogs</option>
          {jogs.map((jog) => (
            <option key={jog.id} value={jog.id}>
              {jog.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="cursor-pointer px-3 py-2 font-medium" onClick={() => toggleSort('title')}>
                Title {sortIndicator('title')}
              </th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="cursor-pointer px-3 py-2 font-medium" onClick={() => toggleSort('jog')}>
                Jog {sortIndicator('jog')}
              </th>
              <th className="cursor-pointer px-3 py-2 font-medium" onClick={() => toggleSort('createdAt')}>
                Created {sortIndicator('createdAt')}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleTickets.map((ticket) => (
              <tr key={ticket.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setEditingTicket(ticket)}
                    className="text-left font-medium text-gray-900 hover:underline"
                  >
                    {ticket.title}
                  </button>
                </td>
                <td className="px-3 py-2 text-gray-600">{statusLabelByValue.get(ticket.status)}</td>
                <td className="px-3 py-2 text-gray-600 capitalize">{ticket.priority}</td>
                <td className="px-3 py-2">
                  <JogSelect value={ticket.jogId} onChange={(jogId) => handleReassign(ticket.id, jogId)} className="w-48" />
                </td>
                <td className="px-3 py-2 text-gray-500">{new Date(ticket.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {visibleTickets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                  No tickets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingTicket && (
        <TicketModal ticket={editingTicket} onClose={() => setEditingTicket(null)} onSaved={handleSaved} onDeleted={handleDeleted} />
      )}
    </div>
  );
}
