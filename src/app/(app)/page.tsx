import { getTickets } from '@/lib/firestore';
import { JogBoard } from '@/components/JogBoard';

export const dynamic = 'force-dynamic';

export default async function JogBoardPage() {
  const tickets = await getTickets();
  return <JogBoard initialTickets={tickets} />;
}
