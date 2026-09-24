import { ticketsRepo } from '@/lib/repos';
import { JogBoard } from '@/components/JogBoard';

export const dynamic = 'force-dynamic';

export default async function JogBoardPage() {
  // Archived tickets are left out of the first load; JogBoard fetches them only if "Show
  // archived" is switched on.
  const tickets = await ticketsRepo.getTickets({ includeArchived: false });
  return <JogBoard initialTickets={tickets} />;
}
