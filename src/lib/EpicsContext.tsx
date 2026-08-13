'use client';

import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { Epic } from './types';

interface EpicsContextValue {
  epics: Epic[];
  refresh: () => Promise<void>;
  createEpic: (name: string) => Promise<Epic>;
  updateEpic: (id: string, name: string) => Promise<void>;
  deleteEpic: (id: string) => Promise<void>;
  archiveEpic: (id: string) => Promise<void>;
}

const EpicsContext = createContext<EpicsContextValue | null>(null);

export function EpicsProvider({
  children,
  initialEpics,
}: {
  children: ReactNode;
  initialEpics: Epic[];
}) {
  const [epics, setEpics] = useState<Epic[]>(initialEpics);
  const [prevInitialEpics, setPrevInitialEpics] = useState(initialEpics);

  if (initialEpics !== prevInitialEpics) {
    setPrevInitialEpics(initialEpics);
    setEpics(initialEpics);
  }

  const refresh = useCallback(async () => {
    const response = await fetch('/api/epics');
    const data: Epic[] = await response.json();
    setEpics(data);
  }, []);

  const createEpic = useCallback(async (name: string) => {
    const response = await fetch('/api/epics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const epic: Epic = await response.json();
    setEpics((prev) => [...prev, epic]);
    return epic;
  }, []);

  const updateEpic = useCallback(async (id: string, name: string) => {
    await fetch(`/api/epics/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setEpics((prev) => prev.map((epic) => (epic.id === id ? { ...epic, name } : epic)));
  }, []);

  const deleteEpic = useCallback(async (id: string) => {
    await fetch(`/api/epics/${id}`, { method: 'DELETE' });
    setEpics((prev) => prev.filter((epic) => epic.id !== id));
  }, []);

  const archiveEpic = useCallback(async (id: string) => {
    await fetch(`/api/epics/${id}/archive`, { method: 'POST' });
    setEpics((prev) =>
      prev.map((epic) =>
        epic.id === id ? { ...epic, isArchived: true, completedAt: new Date().toISOString() } : epic,
      ),
    );
  }, []);

  return (
    <EpicsContext.Provider value={{ epics, refresh, createEpic, updateEpic, deleteEpic, archiveEpic }}>
      {children}
    </EpicsContext.Provider>
  );
}

export function useEpics(): EpicsContextValue {
  const context = useContext(EpicsContext);
  if (!context) throw new Error('useEpics must be used within an EpicsProvider');
  return context;
}
