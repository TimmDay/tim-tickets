import { getTickets } from '@/lib/firestore';
import { BacklogTable } from '@/components/BacklogTable';

export const dynamic = 'force-dynamic';

export default async function BacklogPage() {
  const tickets = await getTickets();
  return <BacklogTable initialTickets={tickets} />;
}
