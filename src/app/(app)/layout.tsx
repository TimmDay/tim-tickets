import { AppHeader } from '@/components/AppHeader';
import { EpicsProvider } from '@/lib/EpicsContext';
import { JogsProvider } from '@/lib/JogsContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <JogsProvider>
      <EpicsProvider>
        <AppHeader />
        <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 py-6">{children}</main>
      </EpicsProvider>
    </JogsProvider>
  );
}
