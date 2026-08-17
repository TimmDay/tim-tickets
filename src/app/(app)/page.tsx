import { ticketsRepo } from '@/lib/repos';
import { JogBoard } from '@/components/JogBoard';

export const dynamic = 'force-dynamic';

export default async function JogBoardPage() {
  const tickets = await ticketsRepo.getTickets();
  return <JogBoard initialTickets={tickets} />;
}
