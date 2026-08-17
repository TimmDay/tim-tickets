'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { TicketModal } from './TicketModal';

const TABS = [
  { href: '/', label: 'Current Jog', mobileLabel: 'Jogging' },
  { href: '/backlog', label: 'Backlog', mobileLabel: 'Backlog' },
  { href: '/jogs', label: 'Jogs', mobileLabel: 'Jogs' },
  { href: '/epics', label: 'Epics', mobileLabel: 'Epics' },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <header className="shrink-0 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
        <nav className="flex gap-0.5 sm:gap-1">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-md px-2 py-1.5 text-sm font-medium sm:px-3 ${
                pathname === tab.href
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              <span className="sm:hidden">{tab.mobileLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-gray-900 px-2 py-1.5 text-sm font-medium text-white hover:bg-gray-800 sm:px-3 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            <span className="sm:hidden">+</span>
            <span className="hidden sm:inline">+ Add</span>
          </button>
          <ThemeToggle />
        </div>
      </div>

      {showCreate && <TicketModal onClose={() => setShowCreate(false)} onSaved={() => router.refresh()} />}
    </header>
  );
}
