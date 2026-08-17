'use client';

import { useRouter } from 'next/navigation';
import { TicketModal } from './TicketModal';
import { Ticket } from '@/lib/types';

/** Renders a ticket opened directly via its shareable `/tickets/<key>` URL. There's no local
 * list state to update here (unlike BacklogTable/JogBoard), so saving or closing both just
 * send the user back to the backlog — TicketModal already closes itself after a save. */
export function TicketDeepLink({ ticket }: { ticket: Ticket }) {
  const router = useRouter();

  return <TicketModal ticket={ticket} onClose={() => router.push('/backlog')} onSaved={() => {}} />;
}
