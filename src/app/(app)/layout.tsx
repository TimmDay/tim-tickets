import { AppFooter } from '@/components/AppFooter';
import { AppHeader } from '@/components/AppHeader';
import { BackToTopButton } from '@/components/BackToTopButton';
import { EpicsProvider } from '@/lib/EpicsContext';
import { FormDraftsProvider } from '@/lib/formDrafts';
import { JogsProvider } from '@/lib/JogsContext';
import { ShowArchivedProvider } from '@/lib/ShowArchivedContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <JogsProvider>
      <EpicsProvider>
        <FormDraftsProvider>
          <ShowArchivedProvider>
            <AppHeader />
            <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 lg:min-h-0">{children}</main>
            <AppFooter />
            <BackToTopButton />
          </ShowArchivedProvider>
        </FormDraftsProvider>
      </EpicsProvider>
    </JogsProvider>
  );
}
