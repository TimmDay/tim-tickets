import { getTickets } from '@/lib/firestore';
import { JogBoard } from '@/components/JogBoard';

export default async function JogBoardPage() {
  const tickets = await getTickets();
  return <JogBoard initialTickets={tickets} />;
}
