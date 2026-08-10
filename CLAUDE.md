# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the dev server (http://localhost:3000)
- `npm run build` — production build (also type-checks)
- `npm run start` — run a production build locally
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`)

No test runner is configured yet.

## Project

Personal issue tracker (Jira/Trello-style kanban board), deployed to Vercel.

- **Framework**: Next.js (App Router) + TypeScript, bootstrapped with `create-next-app`. Source lives under `src/` with the `@/*` path alias pointing at `src/*` (see `tsconfig.json`).
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/postcss`, configured in `postcss.config.mjs` — there is no separate `tailwind.config.ts`).
- **Database**: GCP Firestore, accessed server-side only via the official `@google-cloud/firestore` client (not the Firebase SDK — this is a plain GCP project, no Firebase console involved). Credentials come from a GCP service account (`GCP_PROJECT_ID`, `GCP_CLIENT_EMAIL`, `GCP_PRIVATE_KEY` env vars — see `.env.local.example`).
- **Auth**: single shared password gate (no user accounts). `APP_PASSWORD` / `APP_SESSION_SECRET` env vars, checked via middleware — not yet implemented.
- **Drag-and-drop**: `@dnd-kit/*` is installed for the kanban board interactions, not yet wired up.
- **Validation**: `zod` is installed for validating API route input, not yet used.

## Structure

- `src/app/` — routes, layouts, and API route handlers (Next.js App Router conventions)
- `src/components/` — UI components
- `src/lib/` — server-side utilities (Firestore client, auth/session helpers, shared types)

## Planning

`FEATURES.md` at the repo root is the working spec: board columns, ticket fields, auth flow details, and the feature todo list are being defined there collaboratively rather than assumed up front. Check it before implementing board/ticket/auth behavior — the specifics (e.g. exact columns, ticket schema) are decided there, not fixed by this file.
