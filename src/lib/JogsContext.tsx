'use client';

import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { Jog } from './types';

interface JogsContextValue {
  jogs: Jog[];
  refresh: () => Promise<void>;
  createJog: (name: string, startDate?: string | null, endDate?: string | null) => Promise<Jog>;
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

  return <JogsContext.Provider value={{ jogs, refresh, createJog }}>{children}</JogsContext.Provider>;
}

export function useJogs(): JogsContextValue {
  const context = useContext(JogsContext);
  if (!context) throw new Error('useJogs must be used within a JogsProvider');
  return context;
}
