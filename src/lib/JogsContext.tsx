'use client';

import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { Jog, ORDER_GAP } from './types';

interface JogsContextValue {
  jogs: Jog[];
  refresh: () => Promise<void>;
  createJog: (name: string, startDate?: string | null, endDate?: string | null) => Promise<Jog>;
  updateJog: (id: string, name: string, startDate: string | null, endDate: string | null) => Promise<void>;
  updateJogOrder: (id: string, order: number) => Promise<void>;
  deleteJog: (id: string) => Promise<void>;
  reorderJogs: (orderedIds: string[]) => Promise<void>;
}

const JogsContext = createContext<JogsContextValue | null>(null);

export function JogsProvider({
  children,
  initialJogs,
}: {
  children: ReactNode;
  initialJogs: Jog[];
}) {
  const [jogs, setJogs] = useState<Jog[]>(initialJogs);
  const [prevInitialJogs, setPrevInitialJogs] = useState(initialJogs);

  if (initialJogs !== prevInitialJogs) {
    setPrevInitialJogs(initialJogs);
    setJogs(initialJogs);
  }

  const refresh = useCallback(async () => {
    const response = await fetch('/api/jogs');
    const data: Jog[] = await response.json();
    setJogs(data);
  }, []);

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
    setJogs((prev) => {
      const byId = new Map(prev.map((jog) => [jog.id, jog]));
      return orderedIds.map((id, index) => ({ ...byId.get(id)!, order: index * ORDER_GAP }));
    });
    await fetch('/api/jogs/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: orderedIds }),
    });
  }, []);

  return (
    <JogsContext.Provider value={{ jogs, refresh, createJog, updateJog, updateJogOrder, deleteJog, reorderJogs }}>
      {children}
    </JogsContext.Provider>
  );
}

export function useJogs(): JogsContextValue {
  const context = useContext(JogsContext);
  if (!context) throw new Error('useJogs must be used within a JogsProvider');
  return context;
}
