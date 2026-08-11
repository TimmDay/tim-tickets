import { getTickets } from '@/lib/firestore';
import { BacklogTable } from '@/components/BacklogTable';

export default async function BacklogPage() {
  const tickets = await getTickets();
  return <BacklogTable initialTickets={tickets} />;
}
