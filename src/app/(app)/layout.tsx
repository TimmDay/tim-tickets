import { AppHeader } from '@/components/AppHeader';
import { EpicsProvider } from '@/lib/EpicsContext';
import { JogsProvider } from '@/lib/JogsContext';
import { getEpics, getJogs } from '@/lib/firestore';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [jogs, epics] = await Promise.all([getJogs(), getEpics()]);

  return (
    <JogsProvider initialJogs={jogs}>
      <EpicsProvider initialEpics={epics}>
        <AppHeader />
        <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 py-6">{children}</main>
      </EpicsProvider>
    </JogsProvider>
  );
}
