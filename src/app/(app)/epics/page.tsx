import { ticketsRepo } from '@/lib/repos';
import { EpicsList } from '@/components/EpicsList';

export const dynamic = 'force-dynamic';

export default async function EpicsPage() {
  const tickets = await ticketsRepo.getTickets();
  const ticketCounts: Record<string, number> = {};
  for (const ticket of tickets) {
    if (!ticket.epicId) continue;
    ticketCounts[ticket.epicId] = (ticketCounts[ticket.epicId] ?? 0) + 1;
  }
  return <EpicsList ticketCounts={ticketCounts} />;
}
