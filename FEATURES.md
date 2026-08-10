# FEATURES.md

Working spec for tim-tickets, a personal issue tracker. This is where we decide the functional details together before building them. Update this file as decisions are made.

## Overview

- Personal, single-user issue tracker inspired by Jira/Trello.
- Terminology: a **"jog"** is functionally a sprint.
- Two pages, both behind the password gate: **Jog board** (kanban, scoped to one jog) and **Backlog** (flat list of every ticket, Jira-style).
- Deployed on Vercel, data stored in GCP Firestore, single shared-password gate for access.

## Pages

### `/` — Jog board
- Dropdown at the top selects which jog to view (defaults to "Default Jog" or the first jog).
- Five fixed columns: `todo`, `in_progress`, `blocked`, `in_review`, `done`, populated with tickets whose `jogId` matches the selected jog.
- Drag-and-drop between columns (via `@dnd-kit`) updates a ticket's `status`.
- Clicking a card opens it in the edit modal (includes Delete).
- Ordering within a column: by `createdAt` ascending — no separate manual-order field.

### `/backlog` — Backlog list
- Flat table of **all** tickets across all jogs.
- Client-side text search (title substring match), filter by jog, sort by title / jog / created date (click column header to toggle asc/desc).
- Each row has a jog-reassignment dropdown; selecting "+ New Jog" at the bottom reveals an inline name input to create a jog on the spot (no native browser `prompt()`).

### Global "+ Add" button
- Lives in the header, visible on both pages.
- Opens a ticket-creation modal, reused for editing existing tickets.
- Fields: title, body, jog (select, includes "+ New Jog"), priority, due date, tags (freeform comma-separated).

## Ticket Fields

`status` and `jogId` are independent — moving a ticket to a different jog does not change its status.

```ts
type TicketStatus = 'todo' | 'in_progress' | 'blocked' | 'in_review' | 'done';
type Priority = 'low' | 'medium' | 'high';

interface Ticket {
  id: string;
  title: string;
  body: string;
  status: TicketStatus;
  jogId: string;           // always set, never null
  priority: Priority;
  dueDate: string | null;  // ISO date
  tags: string[];
  createdAt: string;       // ISO — backlog default sort + in-column ordering
  updatedAt: string;       // ISO
}
```

## Jog Fields

Name only, no lifecycle (no start/complete/archive states).

```ts
interface Jog {
  id: string;
  name: string;
  createdAt: string;
}
```

Every ticket always belongs to a jog. "Default Jog" is guaranteed to exist via an `ensureDefaultJog()` check on the jogs-read path — created lazily the first time the `jogs` collection is empty, no manual seed script. New tickets default to whichever jog is selected in the creation modal (itself defaulting to "Default Jog").

## Auth Flow

- Single shared password via `APP_PASSWORD` env var — no user accounts.
- Login page posts to an API route; on match, sets an httpOnly cookie whose value is an HMAC (using `APP_SESSION_SECRET`) — no server-side session store needed.
- `middleware.ts` redirects to `/login` when the cookie is missing/invalid, exempting `/login` and the login API route.

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
- [ ] Build ticket/jog data layer (`src/lib/types.ts`, `src/lib/firestore.ts`)
- [ ] Build auth (`src/lib/auth.ts`, `middleware.ts`, `/login`, auth API routes)
- [ ] Build API routes (`/api/tickets`, `/api/tickets/[id]`, `/api/jogs`)
- [ ] Build `JogsContext`, `AppHeader`, `TicketModal`, `JogSelect`
- [ ] Build Jog board (`/`, `JogBoard`, `JogColumn`, `TicketCard`, drag-and-drop)
- [ ] Build Backlog page (`/backlog`, `BacklogTable`)
- [ ] Set up GCP project + Firestore
- [ ] Set up Vercel project + env vars
- [ ] Decide deployment method
