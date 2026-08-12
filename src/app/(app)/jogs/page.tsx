import { getTickets } from '@/lib/firestore';
import { JogsList } from '@/components/JogsList';

export default async function JogsPage() {
  const tickets = await getTickets();
  const ticketCounts: Record<string, number> = {};
  for (const ticket of tickets) {
    ticketCounts[ticket.jogId] = (ticketCounts[ticket.jogId] ?? 0) + 1;
  }
  return <JogsList ticketCounts={ticketCounts} />;
}
