# Agent run secrets

Runbook for the credentials behind "Release the bots" (see FEATURES.md → *Release the bots*):
what each one does, where it lives, when it expires, how to rotate it, and how a broken one
shows up.

## How the pieces talk

```
tim-tickets (Vercel) ──GITHUB_DISPATCH_TOKEN──▶ GitHub: start workflow in epic repo
                                                   │
                                  CLAUDE_CODE_OAUTH_TOKEN: Claude does the work
                                                   │
tim-tickets (Vercel) ◀──TIM_TICKETS_AGENT_TOKEN── workflow reports back
   checks it against AGENT_API_TOKEN      (+ VERCEL_PROTECTION_BYPASS to get past
                                             preview Deployment Protection)
```

## Inventory

| Secret | Lives in | Used for | Expires? |
|---|---|---|---|
| `GITHUB_DISPATCH_TOKEN` | Vercel env vars (Preview + Production); `.env.local` for local dev | App → GitHub: starting the workflow via `repository_dispatch` | **Yes**: fine-grained PAT, lifetime chosen at creation (max 1 year) |
| `CLAUDE_CODE_OAUTH_TOKEN` | Each epic repo → Settings → Secrets and variables → **Actions** → Repository secrets | Workflow → Claude: authenticates the agent against your Claude subscription | **Yes**: long-lived (about a year); note the date you created it |
| `AGENT_API_TOKEN` | Vercel env vars (Preview + Production); `.env.local` for local dev | App side of report-back: checks the bearer token | No: a random string you generated; rotate only if leaked |
| `TIM_TICKETS_AGENT_TOKEN` | Each epic repo → Actions repository secrets | Workflow side of report-back: must equal `AGENT_API_TOKEN` | No: same as above |
| `VERCEL_PROTECTION_BYPASS` | Vercel → Settings → Deployment Protection → Protection Bypass for Automation (generated there); copied into each epic repo's Actions repository secrets | Workflow → Vercel: sent as `x-vercel-protection-bypass` so report-back gets past Vercel Authentication on **preview** deployments. Optional: production isn't protected | No: rotate only if leaked |
| `TIM_TICKETS_URL` | Each epic repo → Settings → Secrets and variables → Actions → **Variables** tab (not a secret) | Where the "agent PR merged" workflow reports merges: the production app URL | n/a: update if the app's domain changes |
| `AGENT_REPORT_BASE_URL` | `.env.local` only (optional) | Overrides the report-back URL, e.g. a tunnel during local dev | n/a: not a secret; tunnel URLs change each session |

The workflow's own `GITHUB_TOKEN` (used to push the branch and open the PR) is created
automatically per run by GitHub. Nothing to manage.

## Expiry log

Fill this in whenever you create or rotate a token, and put a calendar reminder a week before
each expiry. Dates only, **never** token values.

| Secret | Created | Expires | Repos covered |
|---|---|---|---|
| `GITHUB_DISPATCH_TOKEN` | | | |
| `CLAUDE_CODE_OAUTH_TOKEN` | | | |

## Rotating

### `GITHUB_DISPATCH_TOKEN`
GitHub emails you about a week before a fine-grained token expires.

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens.
2. Open the expiring token → **Regenerate token**, choose a new expiration, and copy the new value.
   (Regenerating keeps the name, repo list and permissions.)
3. Vercel → project → Settings → Environment Variables → edit `GITHUB_DISPATCH_TOKEN` for
   Preview and Production, then **redeploy**. Env vars only reach new deployments.
4. Update `.env.local` if you dispatch locally, and restart `npm run dev`.
5. Update the expiry log.

**Adding a new epic repo** (only if the token uses *Only select repositories*): edit the
token → Repository access → add the repo → Update. No new value, so nothing to change in Vercel.

### `CLAUDE_CODE_OAUTH_TOKEN`
1. Locally: `claude setup-token`, and copy the printed token.
2. In **every** epic repo: Settings → Secrets and variables → Actions → `CLAUDE_CODE_OAUTH_TOKEN` →
   Update secret.
3. Update the expiry log.

Missing one repo is the classic mistake: its runs fail at the Claude step while the others work.
List the repos in the log's *Repos covered* column so you have a checklist.

### `VERCEL_PROTECTION_BYPASS` (if leaked)
Anyone holding it can reach your preview deployments past Vercel's login. They still hit the
app's own password gate.
1. Vercel → Settings → Deployment Protection → Protection Bypass for Automation → regenerate
   (or delete and create a new one).
2. Every epic repo: update the `VERCEL_PROTECTION_BYPASS` Actions secret.

### `AGENT_API_TOKEN` / `TIM_TICKETS_AGENT_TOKEN` (if leaked)
The two must always match, so change them together:
1. `openssl rand -hex 32`
2. Vercel: update `AGENT_API_TOKEN` (Preview + Production), then redeploy. Also `.env.local`.
3. Every epic repo: update `TIM_TICKETS_AGENT_TOKEN`.

Runs already in flight during the swap will get a 401 on report-back. Re-dispatch those tickets.

## Symptoms → cause

| What you see | Likely cause |
|---|---|
| EHH OII dialog: `GitHub dispatch failed (401)` | `GITHUB_DISPATCH_TOKEN` expired or wrong, or env var not on this deployment (redeploy) |
| EHH OII dialog: `GitHub dispatch failed (404)` | Token doesn't include that repo, or the epic's repo URL is wrong |
| EHH OII dialog: `Missing GITHUB_DISPATCH_TOKEN env var` | Not set for this environment, or `npm run dev` not restarted |
| EHH OII dialog: `AGENT_REPORT_BASE_URL is not a valid URL` | Typo in the override; include `https://` |
| Dialog says dispatched, but no run in the repo's Actions tab | Workflow file not on the repo's **default** branch |
| Run fails at the `claude-code-action` step with an auth error | `CLAUDE_CODE_OAUTH_TOKEN` expired, missing, or in the wrong secrets section (must be *Actions*, not *Agents*) |
| PR opened but the "Report back" step fails with 401 | `TIM_TICKETS_AGENT_TOKEN` ≠ `AGENT_API_TOKEN`, or Vercel env not redeployed |
| "Report back" step fails with 401 `Protected deployment` (JSON mentioning `vercel_auth_enabled`) | Dispatched from a protected preview and `VERCEL_PROTECTION_BYPASS` is missing, wrong, or regenerated in Vercel without updating the repo secret |
| "Report back" step fails to connect, or gets HTML back | Report URL unreachable: dispatched from localhost without `AGENT_REPORT_BASE_URL`, tunnel closed, or Vercel Deployment Protection on the preview |
| Merged an agent PR but the ticket didn't move to Done | Check the "tim-tickets agent PR merged" run in Actions. `Set the TIM_TICKETS_URL repository variable` means the variable is missing. No run at all means the branch wasn't `agent/T-<n>-<run>`, the PR was closed without merging, or the workflow isn't on the default branch |
| Ticket stuck In Progress, skipped by later runs | Report-back never landed, so the dispatch stamp was never cleared. Fix the cause above, then tick *re-dispatch* in the dialog, or report back by hand (below) |

## Reporting back by hand

If a run opened a PR but couldn't report back, apply the result yourself:

```
curl -X POST https://<app-url>/api/agent/tickets/T-xx/report \
  -H "Authorization: Bearer $AGENT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-vercel-protection-bypass: $VERCEL_PROTECTION_BYPASS" \
  -d '{"outcome":"pr_opened","prUrl":"https://github.com/<owner>/<repo>/pull/<n>"}'
```

For a merged PR that didn't move its ticket, send `{"outcome":"merged","prUrl":"…"}` the same way. The bypass header is only needed for a protected preview URL. Use `{"outcome":"failed"}` instead to just clear the stamp without moving the ticket.

## Local dev with a tunnel

1. `cloudflared tunnel --url http://localhost:3000` (or `ngrok http 3000`), and copy the public URL.
2. `.env.local`: `AGENT_REPORT_BASE_URL=https://<that-url>`, then restart `npm run dev`.
3. Use the app normally on localhost. Dispatched runs report back through the tunnel.

Quick tunnel URLs change every time you restart the tunnel, so update the variable each session.
Unset it when you're done: if it points at a dead tunnel, every run's report-back fails.
