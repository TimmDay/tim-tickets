'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { TicketModal } from './TicketModal';

const TABS = [
  { href: '/', label: 'Jog' },
  { href: '/backlog', label: 'Backlog' },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                pathname === tab.href ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          + Add
        </button>
      </div>

      {showCreate && <TicketModal onClose={() => setShowCreate(false)} onSaved={() => router.refresh()} />}
    </header>
  );
}
