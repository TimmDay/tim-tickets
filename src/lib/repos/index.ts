// Composition root: wires each entity's repo factory to the real Firestore singleton. Kept
// separate from the factories themselves (tickets.ts, jogs.ts, ...) so that importing a factory
// for a test — which passes in a fake FirestoreLike — never touches getFirestore() and never
// requires real GCP credentials to be present.
import { getFirestore } from './client';
import { createEpicsRepo } from './epics';
import { createJogsRepo } from './jogs';
import { createLoginAttemptsRepo } from './loginAttempts';
import { createTicketsRepo } from './tickets';

export const ticketsRepo = createTicketsRepo(getFirestore());
export const jogsRepo = createJogsRepo(getFirestore());
export const epicsRepo = createEpicsRepo(getFirestore());
export const loginAttemptsRepo = createLoginAttemptsRepo(getFirestore());

export type { CreateTicketInput, TicketsRepo, UpdateTicketInput } from './tickets';
export type { JogsRepo, UpdateJogInput } from './jogs';
export type { EpicsRepo, UpdateEpicInput } from './epics';
export type { LoginAttemptsRepo } from './loginAttempts';
