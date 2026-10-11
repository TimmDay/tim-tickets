'use client';

import { useState, useSyncExternalStore } from 'react';
import { useEpics } from './EpicsContext';
import { createTicketStore, TicketStore, TicketStoreState } from './ticketStore';
import { ticketsApi } from './ticketsApi';
import { Ticket } from './types';

/** Binds a ticket store to a page's server-rendered tickets. A new `initialTickets` (after a
 * `router.refresh()`) starts a fresh store, so a server refresh always wins over local state. */
export function useTicketStore(initialTickets: Ticket[]): [TicketStoreState, TicketStore] {
  const { refresh: refreshEpics } = useEpics();
  const create = () => createTicketStore(initialTickets, ticketsApi, { onEpicStarted: refreshEpics });
  const [store, setStore] = useState(create);
  const [prevInitialTickets, setPrevInitialTickets] = useState(initialTickets);

  if (initialTickets !== prevInitialTickets) {
    setPrevInitialTickets(initialTickets);
    setStore(create());
  }

  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return [state, store];
}
