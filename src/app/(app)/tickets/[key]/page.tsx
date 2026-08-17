import { notFound } from 'next/navigation';
import { getTicketByKey } from '@/lib/firestore';
import { TicketDeepLink } from '@/components/TicketDeepLink';

export const dynamic = 'force-dynamic';

export default async function TicketByKeyPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const ticket = await getTicketByKey(key);
  if (!ticket) notFound();

  return <TicketDeepLink ticket={ticket} />;
}
