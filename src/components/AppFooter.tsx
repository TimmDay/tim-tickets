'use client';

import { useRouter } from 'next/navigation';

export function AppFooter() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <footer className="shrink-0 border-t border-gray-200 bg-white lg:hidden dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex max-w-5xl justify-end px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md px-2 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          Log out
        </button>
      </div>
    </footer>
  );
}
