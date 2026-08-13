import { getTickets } from '@/lib/firestore';
import { EpicsList } from '@/components/EpicsList';

export default async function EpicsPage() {
  const tickets = await getTickets();
  const ticketCounts: Record<string, number> = {};
  for (const ticket of tickets) {
    if (!ticket.epicId) continue;
    ticketCounts[ticket.epicId] = (ticketCounts[ticket.epicId] ?? 0) + 1;
  }
  return <EpicsList ticketCounts={ticketCounts} />;
}
