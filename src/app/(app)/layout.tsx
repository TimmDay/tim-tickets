import { AppFooter } from '@/components/AppFooter';
import { AppHeader } from '@/components/AppHeader';
import { BackToTopButton } from '@/components/BackToTopButton';
import { StaleDataRefresher } from '@/components/StaleDataRefresher';
import { EpicsProvider } from '@/lib/EpicsContext';
import { FormDraftsProvider } from '@/lib/formDrafts';
import { JogsProvider } from '@/lib/JogsContext';
import { epicsRepo, jogsRepo } from '@/lib/repos';
import { ShowArchivedProvider } from '@/lib/ShowArchivedContext';

// Every page under (app) is already force-dynamic; stated here too because this layout now
// reads Firestore itself and must never be prerendered at build time (no credentials in CI).
export const dynamic = 'force-dynamic';

/** When this HTML was rendered on the server. Read once per request, so the render stays
 * deterministic for React; the client compares it to its own clock (see StaleDataRefresher). */
function renderTimestamp(): number {
  return Date.now();
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Next renders this layout and the page concurrently, so these two reads run in parallel with
  // the page's own ticket read — instead of the old waterfall where the client fetched
  // /api/jogs and /api/epics only after hydration.
  const [jogs, epics] = await Promise.all([jogsRepo.getJogs(), epicsRepo.getEpics()]);
  const renderedAt = renderTimestamp();

  return (
    <JogsProvider initialJogs={jogs}>
      <EpicsProvider initialEpics={epics}>
        <FormDraftsProvider>
          <ShowArchivedProvider>
            <StaleDataRefresher renderedAt={renderedAt} />
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
