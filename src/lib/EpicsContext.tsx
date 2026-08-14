'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DEFAULT_EPIC_COLOR_THEME, Epic, EpicColorTheme } from './types';

interface EpicsContextValue {
  epics: Epic[];
  refresh: () => Promise<void>;
  createEpic: (name: string, description?: string, colorTheme?: EpicColorTheme) => Promise<Epic>;
  updateEpic: (id: string, name: string, description: string, colorTheme: EpicColorTheme) => Promise<void>;
  deleteEpic: (id: string) => Promise<void>;
  archiveEpic: (id: string) => Promise<void>;
}

const EpicsContext = createContext<EpicsContextValue | null>(null);

export function EpicsProvider({ children }: { children: ReactNode }) {
  const [epics, setEpics] = useState<Epic[]>([]);
  const hasFetched = useRef(false);

  const refresh = useCallback(async () => {
    const response = await fetch('/api/epics');
    const data: Epic[] = await response.json();
    setEpics(data);
  }, []);

  // Fetched once client-side on first mount, rather than server-rendered per navigation —
  // this provider lives at the layout level and isn't remounted by client-side navigation
  // between sibling routes, so a single fetch here covers the whole session.
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    refresh();
  }, [refresh]);

  const createEpic = useCallback(
    async (name: string, description: string = '', colorTheme: EpicColorTheme = DEFAULT_EPIC_COLOR_THEME) => {
      const response = await fetch('/api/epics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, colorTheme }),
      });
      const epic: Epic = await response.json();
      setEpics((prev) => [...prev, epic]);
      return epic;
    },
    [],
  );

  const updateEpic = useCallback(async (id: string, name: string, description: string, colorTheme: EpicColorTheme) => {
    await fetch(`/api/epics/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, colorTheme }),
    });
    setEpics((prev) => prev.map((epic) => (epic.id === id ? { ...epic, name, description, colorTheme } : epic)));
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
