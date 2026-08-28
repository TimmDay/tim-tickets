'use client';

import { createContext, ReactNode, useContext, useState } from 'react';

interface ShowArchivedStore {
  showArchived: boolean;
  setShowArchived: (value: boolean) => void;
}

const ShowArchivedContext = createContext<ShowArchivedStore | null>(null);

/** Mounted once at the app layout so the "Show archived" toggle survives client-side navigation between pages. */
export function ShowArchivedProvider({ children }: { children: ReactNode }) {
  const [showArchived, setShowArchived] = useState(false);
  return (
    <ShowArchivedContext.Provider value={{ showArchived, setShowArchived }}>{children}</ShowArchivedContext.Provider>
  );
}

export function useShowArchived(): ShowArchivedStore {
  const context = useContext(ShowArchivedContext);
  if (!context) throw new Error('useShowArchived must be used within a ShowArchivedProvider');
  return context;
}
