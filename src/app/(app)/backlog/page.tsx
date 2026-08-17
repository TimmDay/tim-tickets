import { ticketsRepo } from '@/lib/repos';
import { BacklogTable } from '@/components/BacklogTable';

export const dynamic = 'force-dynamic';

export default async function BacklogPage() {
  const tickets = await ticketsRepo.getTickets();
  return <BacklogTable initialTickets={tickets} />;
}
