'use client';

import { createContext, ReactNode, useContext, useMemo, useRef } from 'react';
import { EpicColorTheme, Priority } from './types';

interface DraftStore<T> {
  getDraft: () => T | null;
  setDraft: (value: T) => void;
  clearDraft: () => void;
}

/**
 * Backs a "new X" form's in-progress draft with a ref, not state — nothing needs to reactively
 * re-render when a draft changes (the owning modal already re-renders itself via its own local
 * field state; this store is only ever read once, at mount, to seed it). The context value is
 * memoized with an empty dep array, so it never changes identity and consumers never re-render
 * because of it. Scoping the ref inside a Provider (rather than a bare module-level variable)
 * means a fresh mount — such as between tests — gets a clean slate automatically, no manual
 * reset needed.
 */
function createDraftStore<T>() {
  const Context = createContext<DraftStore<T> | null>(null);

  function Provider({ children }: { children: ReactNode }) {
    const draftRef = useRef<T | null>(null);
    const store = useMemo<DraftStore<T>>(
      () => ({
        getDraft: () => draftRef.current,
        setDraft: (value: T) => {
          draftRef.current = value;
        },
        clearDraft: () => {
          draftRef.current = null;
        },
      }),
      [],
    );
    return <Context.Provider value={store}>{children}</Context.Provider>;
  }

  function useDraftStore(): DraftStore<T> {
    const context = useContext(Context);
    if (!context) throw new Error('useDraftStore must be used within its matching Provider');
    return context;
  }

  return { Provider, useDraftStore };
}

export interface NewTicketDraft {
  title: string;
  body: string;
  jogId: string;
  epicId: string | null;
  priority: Priority | null;
  dueDate: string;
  tags: string[];
}

export interface NewJogDraft {
  name: string;
  startDate: string;
  endDate: string;
}

export interface NewEpicDraft {
  name: string;
  description: string;
  colorTheme: EpicColorTheme;
}

const newTicketDraftStore = createDraftStore<NewTicketDraft>();
const newJogDraftStore = createDraftStore<NewJogDraft>();
const newEpicDraftStore = createDraftStore<NewEpicDraft>();

export const useNewTicketDraft = newTicketDraftStore.useDraftStore;
export const useNewJogDraft = newJogDraftStore.useDraftStore;
export const useNewEpicDraft = newEpicDraftStore.useDraftStore;

/** Mounted once at the app layout, alongside JogsProvider/EpicsProvider. */
export function FormDraftsProvider({ children }: { children: ReactNode }) {
  return (
    <newTicketDraftStore.Provider>
      <newJogDraftStore.Provider>
        <newEpicDraftStore.Provider>{children}</newEpicDraftStore.Provider>
      </newJogDraftStore.Provider>
    </newTicketDraftStore.Provider>
  );
}
