import { ticketsRepo } from '@/lib/repos';
import { JogsList } from '@/components/JogsList';

export const dynamic = 'force-dynamic';

export default async function JogsPage() {
  const tickets = await ticketsRepo.getTickets();
  const ticketCounts: Record<string, number> = {};
  for (const ticket of tickets) {
    ticketCounts[ticket.jogId] = (ticketCounts[ticket.jogId] ?? 0) + 1;
  }
  return <JogsList ticketCounts={ticketCounts} />;
}
