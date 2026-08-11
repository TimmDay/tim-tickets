import { AppHeader } from '@/components/AppHeader';
import { JogsProvider } from '@/lib/JogsContext';
import { getJogs } from '@/lib/firestore';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const jogs = await getJogs();

  return (
    <JogsProvider initialJogs={jogs}>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </JogsProvider>
  );
}
