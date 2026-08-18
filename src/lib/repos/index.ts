// Composition root: wires each entity's repo factory to the real Firestore singleton. Kept
// separate from the factories themselves (tickets.ts, jogs.ts, ...) so that importing a factory
// for a test — which passes in a fake FirestoreLike — never touches getFirestore() and never
// requires real GCP credentials to be present.
import { getFirestore } from './client';
import { createEpicsRepo } from './epics';
import { createJogsRepo } from './jogs';
import { createLoginAttemptsRepo } from './loginAttempts';
import { createTicketsRepo } from './tickets';

// Merely *importing* this module must never construct the real Firestore client — Next.js
// imports every route module (to inspect its config) as part of `next build`'s page-data
// collection, which happens with no credentials available in CI. lazyRepo() defers the
// getFirestore()+factory call to the first time a method is actually accessed, so
// `import { ticketsRepo } from '@/lib/repos'` stays free, and only calling
// `ticketsRepo.getTickets()` at request time pays for it — matching how the pre-split
// firestore.ts always called getFirestore() lazily inside each function body, never at
// module load.
function lazyRepo<T extends object>(create: () => T): T {
  let instance: T | null = null;
  const getInstance = () => (instance ??= create());
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      return Reflect.get(getInstance() as object, prop, receiver);
    },
  });
}

export const ticketsRepo = lazyRepo(() => createTicketsRepo(getFirestore()));
export const jogsRepo = lazyRepo(() => createJogsRepo(getFirestore()));
export const epicsRepo = lazyRepo(() => createEpicsRepo(getFirestore()));
export const loginAttemptsRepo = lazyRepo(() => createLoginAttemptsRepo(getFirestore()));

export type { CreateTicketInput, TicketsRepo, UpdateTicketInput } from './tickets';
export type { JogsRepo, UpdateJogInput } from './jogs';
export type { EpicsRepo, UpdateEpicInput } from './epics';
export type { LoginAttemptsRepo } from './loginAttempts';
