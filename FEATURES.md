# FEATURES.md

Working spec for tim-tickets, a personal issue tracker. This is where we decide the functional details together before building them. Update this file as decisions are made.

## Overview

- Personal, single-user issue tracker inspired by Jira/Trello.
- Terminology: a **"jog"** is functionally a sprint.
- Four pages, all behind the password gate: **Current Jog** (kanban, scoped to one jog), **Backlog** (flat list of every ticket, Jira-style), **Jogs** (manage jogs), **Epics** (manage epics).
- An **epic** is an optional grouping of tickets by topic/feature/project (a ticket belongs to at most one epic). Epics are independent of jogs — a jog is "when", an epic is "what project".
- Deployed on Vercel, data stored in GCP Firestore, single shared-password gate for access.

## Pages

### `/` — Current Jog board
- Dropdown at the top selects which jog to view (defaults to "Default Jog" or the first jog), or "All tickets" (listed last, below the jogs) to show every ticket unscoped by jog.
- A second dropdown filters the board by epic (All epics / No epic / a specific epic).
- Clicking a jog's or epic's title on the Jogs/Epics pages navigates here with that filter pre-applied — a jog click selects that jog in the first dropdown; an epic click selects "All tickets" + that epic, via `?jogId=`/`?epicId=` query params consumed once on mount and then stripped from the URL.
- Five fixed columns: `todo`, `in_progress`, `blocked`, `in_review`, `done`, populated with tickets whose `jogId` matches the selected jog.
- Cards are draggable both across columns (updates `status`) and within a column (reorders `order`), via `@dnd-kit/sortable`'s multi-container pattern.
- Clicking a card opens it in the edit modal (includes Delete, and a Comments section — see below).
- Columns fill the full remaining viewport height; each column's ticket list scrolls internally rather than growing the page.

### `/backlog` — Backlog list
- Flat table of **all** tickets across all jogs.
- Client-side text search (title substring match), filter by jog, filter by epic (All epics / No epic / a specific epic), sort by title / jog / created date (click column header to toggle asc/desc), or drag rows via a grip handle to set a manual order (only active when no search/filter is applied and no column sort is active — dragging while a column sort or filter is active would be ambiguous, so the handle is shown but disabled with an explanatory tooltip in that state).
- Each row has a jog-reassignment dropdown; selecting "+ New Jog" at the bottom reveals an inline name input to create a jog on the spot (no native browser `prompt()`), plus a "New jog" button next to the filter dropdown that opens the same create/edit modal.
- Each row has a delete icon (trash, right end) opening a confirmation modal before deleting.
- Table fills the full remaining viewport height with internal scroll.

### `/jogs` — Jogs list
- Table of every jog: name, start date, end date.
- Drag rows via a grip handle to reorder (persisted, always active — no competing sort/filter here).
- Edit icon per row opens the same create/edit modal used for "+ New Jog"; editing only changes the jog's own name/dates, never its ID, so ticket membership (`ticket.jogId`) is untouched.
- Delete icon per row opens a confirmation modal. The structurally-special "default jog" (earliest-created, guaranteed to always exist) cannot be deleted — its delete icon is disabled. Deleting any other jog reassigns its member tickets to the default jog rather than orphaning them.
- Table fills the full remaining viewport height with internal scroll.

### `/epics` — Epics list
- Table of every epic: name, created date, started date, completed date, ticket count.
- Clicking an epic's name navigates to the Current Jog board with the jog dropdown set to "All tickets" and the epic filter set to this epic (see below).
- Edit icon per row opens the same create/edit modal used for "+ New Epic"; editing only changes the epic's name.
- Delete icon per row opens a confirmation modal; deleting an epic clears `epicId` on its member tickets (there's no "default epic" to reassign to — a ticket's epic is always optional).
- Archive action opens a confirmation modal; archiving an epic archives it **and every ticket assigned to it, regardless of status** (unlike jog completion, which only auto-archives `done` tickets and reassigns the rest — epics have no "in-flight" concept to preserve). Archived epics are hidden by default; a "Show archived" checkbox reveals them.
- No manual reorder — epics aren't sequenced like jogs, so the list has no drag handle.
- Table fills the full remaining viewport height with internal scroll.

### Global "+ Add" button
- Lives in the header, visible on all pages.
- Opens a ticket-creation modal, reused for editing existing tickets.
- Fields: title, body, jog (select, includes "+ New Jog"), priority, tags (freeform comma-separated), epic (select, includes "+ New Epic", optional), due date.
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
  status: TicketStatus;
  jogId: string;           // always set, never null
  epicId: string | null;   // optional; a ticket belongs to at most one epic
  priority: Priority;
  dueDate: string | null;  // ISO date
  tags: string[];
  comments: Comment[];
  order: number;           // manual/backlog + per-column kanban ordering
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
}
```

## Epic Fields

Name plus a lifecycle flag; no manual ordering — epics are grouped by topic, not sequenced in time like jogs. `startedAt` is stamped automatically (not user-set) the first time any member ticket's status moves off `todo` (set in `updateTicket`, once — never overwritten after). `completedAt` is stamped when the epic is archived.

```ts
type EpicColorTheme = 'indigo' | 'blue' | 'emerald' | 'rose' | 'amber';

interface Epic {
  id: string;
  name: string;
  description: string;        // optional; shown as a tooltip on the epic chip
  colorTheme: EpicColorTheme; // chosen in the epic create/edit modal; defaults to 'indigo'
  isArchived: boolean;
  startedAt: string | null;   // ISO; auto-set once, first ticket to leave `todo`
  completedAt: string | null; // ISO; set when the epic is archived
  createdAt: string;          // ISO
}
```

Wherever an epic appears as a chip (ticket cards on the Current Jog board, and inline after the title on the Backlog page), it's rendered via a shared `EpicChip` component: colored per the epic's `colorTheme`, with a custom CSS tooltip (not the native `title` attribute, which has a much longer hover delay) showing the epic's description on hover, when one is set. The epic create/edit modal has an `EpicColorThemeSelect` — a custom dropdown (not a native `<select>`, so each option can render as an actual colored chip preview) offering the 5 themes above.

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
- A `JogsContext` provider (mounted once in `layout.tsx`) shares one live jogs list across the board selector, backlog row dropdowns, and the ticket modal, instead of each fetching/duplicating it. An `EpicsContext` provider, mounted alongside it, does the same for epics.
- A `ShowArchivedContext` provider, mounted alongside them, holds one "show archived" toggle shared by the Current Jog board, Backlog, Jogs, and Epics pages (each previously tracked its own local `showArchived` state) — checking it on one page keeps it checked when you navigate to another.

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
- [x] Add Epics: data layer, API routes, `EpicsContext`, `EpicSelect`/`EpicModal`, `/epics` (`EpicsList`), epic filter on board + backlog, epic chip on ticket cards, archive-cascade
- [x] Set up Vercel project + env vars
- [x] Decide deployment method (vercel for now)
