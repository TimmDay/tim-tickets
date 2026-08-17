'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Jog, ORDER_GAP } from './types';

interface JogsContextValue {
  jogs: Jog[];
  /** The structurally-special default jog (earliest-created, guaranteed to always exist
   * once jogs have loaded) — undefined only until the initial fetch resolves. */
  defaultJogId: string | undefined;
  refresh: () => Promise<void>;
  createJog: (name: string, startDate?: string | null, endDate?: string | null) => Promise<Jog>;
  updateJog: (id: string, name: string, startDate: string | null, endDate: string | null) => Promise<void>;
  updateJogOrder: (id: string, order: number) => Promise<void>;
  deleteJog: (id: string) => Promise<void>;
  reorderJogs: (orderedIds: string[]) => Promise<void>;
  completeJog: (id: string) => Promise<void>;
}

const JogsContext = createContext<JogsContextValue | null>(null);

export function JogsProvider({ children }: { children: ReactNode }) {
  const [jogs, setJogs] = useState<Jog[]>([]);
  const hasFetched = useRef(false);

  const refresh = useCallback(async () => {
    const response = await fetch('/api/jogs');
    const data: Jog[] = await response.json();
    setJogs(data);
  }, []);

  // Fetched once client-side on first mount, rather than server-rendered per navigation —
  // this provider lives at the layout level and isn't remounted by client-side navigation
  // between sibling routes, so a single fetch here covers the whole session.
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    refresh();
  }, [refresh]);

  const createJog = useCallback(async (name: string, startDate?: string | null, endDate?: string | null) => {
    const response = await fetch('/api/jogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, startDate: startDate ?? null, endDate: endDate ?? null }),
    });
    const jog: Jog = await response.json();
    setJogs((prev) => [...prev, jog]);
    return jog;
  }, []);

  const updateJog = useCallback(
    async (id: string, name: string, startDate: string | null, endDate: string | null) => {
      await fetch(`/api/jogs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, startDate, endDate }),
      });
      setJogs((prev) => prev.map((jog) => (jog.id === id ? { ...jog, name, startDate, endDate } : jog)));
    },
    [],
  );

  const updateJogOrder = useCallback(async (id: string, order: number) => {
    setJogs((prev) => prev.map((jog) => (jog.id === id ? { ...jog, order } : jog)));
    await fetch(`/api/jogs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
  }, []);

  const deleteJog = useCallback(async (id: string) => {
    const response = await fetch(`/api/jogs/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error ?? 'Failed to delete jog');
    }
    setJogs((prev) => prev.filter((jog) => jog.id !== id));
  }, []);

  const reorderJogs = useCallback(async (orderedIds: string[]) => {
    // orderedIds is only the currently-visible (filtered) subset, not the full jogs list —
    // update order in place rather than replacing `jogs` wholesale, or any archived/filtered-out
    // jog would be dropped from context state until the next full refresh().
    setJogs((prev) => {
      const orderById = new Map(orderedIds.map((id, index) => [id, index * ORDER_GAP]));
      return prev.map((jog) => (orderById.has(jog.id) ? { ...jog, order: orderById.get(jog.id)! } : jog));
    });
    await fetch('/api/jogs/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: orderedIds }),
    });
  }, []);

  const defaultJogId = useMemo(
    () => jogs.reduce((earliest, jog) => (jog.createdAt < earliest.createdAt ? jog : earliest), jogs[0])?.id,
    [jogs],
  );

  const completeJog = useCallback(async (id: string) => {
    const response = await fetch(`/api/jogs/${id}/complete`, { method: 'POST' });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error ?? 'Failed to complete jog');
    }
    setJogs((prev) => prev.map((jog) => (jog.id === id ? { ...jog, isArchived: true } : jog)));
  }, []);

  return (
    <JogsContext.Provider
      value={{ jogs, defaultJogId, refresh, createJog, updateJog, updateJogOrder, deleteJog, reorderJogs, completeJog }}
    >
      {children}
    </JogsContext.Provider>
  );
}

export function useJogs(): JogsContextValue {
  const context = useContext(JogsContext);
  if (!context) throw new Error('useJogs must be used within a JogsProvider');
  return context;
}
