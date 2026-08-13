# FEATURES.md

Working spec for tim-tickets, a personal issue tracker. This is where we decide the functional details together before building them. Update this file as decisions are made.

## Overview

- Personal, single-user issue tracker inspired by Jira/Trello.
- Terminology: a **"jog"** is functionally a sprint.
- Three pages, all behind the password gate: **Current Jog** (kanban, scoped to one jog), **Backlog** (flat list of every ticket, Jira-style), **Jogs** (manage jogs).
- Deployed on Vercel, data stored in GCP Firestore, single shared-password gate for access.

## Pages

### `/` — Current Jog board
- Dropdown at the top selects which jog to view (defaults to "Default Jog" or the first jog).
- Five fixed columns: `todo`, `in_progress`, `blocked`, `in_review`, `done`, populated with tickets whose `jogId` matches the selected jog.
- Cards are draggable both across columns (updates `status`) and within a column (reorders `order`), via `@dnd-kit/sortable`'s multi-container pattern.
- Clicking a card opens it in the edit modal (includes Delete, and a Comments section — see below).
- Columns fill the full remaining viewport height; each column's ticket list scrolls internally rather than growing the page.

### `/backlog` — Backlog list
- Flat table of **all** tickets across all jogs.
- Client-side text search (title substring match), filter by jog, sort by title / jog / created date (click column header to toggle asc/desc), or drag rows via a grip handle to set a manual order (only active when no search/filter is applied and no column sort is active — dragging while a column sort or filter is active would be ambiguous, so the handle is shown but disabled with an explanatory tooltip in that state).
- Each row has a jog-reassignment dropdown; selecting "+ New Jog" at the bottom reveals an inline name input to create a jog on the spot (no native browser `prompt()`), plus a "New jog" button next to the filter dropdown that opens the same create/edit modal.
- Each row has a delete icon (trash, right end) opening a confirmation modal before deleting.
- Table fills the full remaining viewport height with internal scroll.

### `/jogs` — Jogs list
- Table of every jog: name, start date, end date.
- Drag rows via a grip handle to reorder (persisted, always active — no competing sort/filter here).
- Edit icon per row opens the same create/edit modal used for "+ New Jog"; editing only changes the jog's own name/dates, never its ID, so ticket membership (`ticket.jogId`) is untouched.
- Delete icon per row opens a confirmation modal. The structurally-special "default jog" (earliest-created, guaranteed to always exist) cannot be deleted — its delete icon is disabled. Deleting any other jog reassigns its member tickets to the default jog rather than orphaning them.
- Table fills the full remaining viewport height with internal scroll.

### Global "+ Add" button
- Lives in the header, visible on all three pages.
- Opens a ticket-creation modal, reused for editing existing tickets.
- Fields: title, body, acceptance criteria (optional, one testable line per bullet), jog (select, includes "+ New Jog"), priority, due date, tags (freeform comma-separated).
- Clicking outside the modal (the backdrop) closes it, same as Cancel.

### Comments
- Tickets can have comments, added from the edit modal (list at the bottom + an add-comment input, independent of the main Save button).
- Each ticket card on the board shows an info icon in its top-right corner; hovering it shows a popover with the ticket's comments.

## Ticket Fields

`status` and `jogId` are independent — moving a ticket to a different jog does not change its status. `order` is a single global ranking used both for manual position in the Backlog list and, filtered by status, for position within a kanban column.

```ts
type TicketStatus = 'todo' | 'in_progress' | 'blocked' | 'in_review' | 'done';
type Priority = 'low' | 'medium' | 'high';

interface Comment {
  id: string;
  body: string;
  createdAt: string; // ISO
}

interface Ticket {
  id: string;
  title: string;
  body: string;
  acceptanceCriteria: string; // optional; one testable bullet per line
  status: TicketStatus;
  jogId: string;           // always set, never null
  priority: Priority;
  dueDate: string | null;  // ISO date
  tags: string[];
  comments: Comment[];
  order: number;           // manual/backlog + per-column kanban ordering
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
}
```

## Jog Fields

Name, optional start/end dates, manual `order`, no lifecycle (no start/complete/archive states).

```ts
interface Jog {
  id: string;
  name: string;
  startDate: string | null; // ISO date, optional
  endDate: string | null;   // ISO date, optional
  order: number;
  createdAt: string;
}
```

Start/end dates are set via a small optional date-range picker inside the jog create/edit modal; when set, the range is shown next to the jog selector on the board.

Every ticket always belongs to a jog. "Default Jog" is guaranteed to exist via an `ensureDefaultJog()` check on the jogs-read path — created lazily the first time the `jogs` collection is empty, no manual seed script. It's identified for protection purposes (can't be deleted) by earliest `createdAt`, independent of its display `order`. New tickets default to whichever jog is selected in the creation modal (itself defaulting to "Default Jog").

## Ordering mechanism

`order` is a fractional index (`src/lib/ordering.ts`), not a sequential position. On drag, only the moved item is given a new value — the midpoint between its new neighbors' `order` values — and persisted via a single `PATCH` to that one ticket/jog. This avoids rewriting every document on every drag (the original implementation renumbered the whole list each time). If repeated inserts into the same slot ever shrink a gap below floating-point precision, that's detected (`needsRebalance`) and falls back to a full renumber via the `/api/tickets/reorder` / `/api/jogs/reorder` bulk endpoints, spacing everything back out by `ORDER_GAP` — an edge case that shouldn't occur in normal use (verified it takes 1000+ repeated same-slot inserts to trigger).

## Auth Flow

- Single shared password via `APP_PASSWORD` env var — no user accounts.
- Login page posts to an API route; on match, sets an httpOnly cookie whose value is an HMAC (using `APP_SESSION_SECRET`) — no server-side session store needed.
- `src/proxy.ts` (Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`) redirects to `/login` when the cookie is missing/invalid, exempting `/login` and the login API route.

## Data Model / Architecture

- **Database**: GCP Firestore via `@google-cloud/firestore` (plain GCP, not the Firebase SDK). Credentials via `GCP_PROJECT_ID` / `GCP_CLIENT_EMAIL` / `GCP_PRIVATE_KEY`.
- Pages are server components doing the initial Firestore read directly; interactive pieces are client components that mutate via API routes and update local state optimistically. No SWR/React Query — dataset is small and single-user.
- A `JogsContext` provider (mounted once in `layout.tsx`) shares one live jogs list across the board selector, backlog row dropdowns, and the ticket modal, instead of each fetching/duplicating it.

## Deployment

_TBD — GitHub + Vercel auto-deploy vs Vercel CLI; GCP Firestore project setup steps._

## Todo

- [x] Decide board columns
- [x] Decide ticket fields
- [x] Decide auth flow details
- [x] Build ticket/jog data layer (`src/lib/types.ts`, `src/lib/firestore.ts`)
- [x] Build auth (`src/lib/auth.ts`, `src/proxy.ts`, `/login`, auth API routes)
- [x] Build API routes (tickets, jogs, comments, reorder endpoints)
- [x] Build `JogsContext`, `AppHeader`, `TicketModal`, `JogSelect`, `JogModal`, `ConfirmModal`
- [x] Build Jog board (`/`, `JogBoard`, `JogColumn`, `TicketCard`) with cross-column and within-column drag-and-drop
- [x] Build Backlog page (`/backlog`, `BacklogTable`) with search/filter/sort, drag-reorder, delete
- [x] Build Jogs page (`/jogs`, `JogsList`) with edit, delete, drag-reorder
- [x] Add comments on tickets (list in edit modal, hover popover on cards)
- [x] Full-height layout: header fixed, board columns / lists fill to viewport bottom with internal scroll
- [x] GCP project (`tim-tickets-505200`) + Firestore (`australia-southeast1`, Native mode) set up, billing linked with a $5/mo budget alert
- [x] `npm run build` / `npm run lint` pass; smoke-tested locally against real Firestore
- [ ] Set up Vercel project + env vars
- [ ] Decide deployment method
