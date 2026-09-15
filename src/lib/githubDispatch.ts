import { AGENT_WORKFLOW_PATH, interpretRepoReadiness, RepoAgentReadiness } from './agentRuns';
import { GithubRepoRef } from './github';

function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/**
 * Checks whether `repo` has the agent workflow on its default branch, using the dispatch token
 * (its Contents: read covers this — no extra permissions). Never throws: problems with the check
 * itself come back as `unknown` so callers can decide not to block on them.
 */
export async function checkRepoAgentReadiness(repo: GithubRepoRef): Promise<RepoAgentReadiness> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return { status: 'unknown', message: 'Missing GITHUB_DISPATCH_TOKEN env var' };

  const base = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`;
  try {
    // HEAD-like use of the contents API: only the status matters, not the file body.
    const workflow = await fetch(`${base}/contents/${AGENT_WORKFLOW_PATH}`, { headers: githubHeaders(token), cache: 'no-store' });
    if (workflow.status !== 404) return interpretRepoReadiness(workflow.status);
    const repoResponse = await fetch(base, { headers: githubHeaders(token), cache: 'no-store' });
    return interpretRepoReadiness(404, repoResponse.status);
  } catch (error) {
    return { status: 'unknown', message: `GitHub check failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** Sends a `repository_dispatch` event to a repo, which triggers any workflow listening for
 * `on: repository_dispatch: types: [eventType]`. Needs `GITHUB_DISPATCH_TOKEN` — a
 * fine-grained PAT with Contents: read & write on the target repos. */
export async function sendRepositoryDispatch(
  repo: GithubRepoRef,
  eventType: string,
  clientPayload: Record<string, unknown>,
): Promise<void> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) throw new Error('Missing GITHUB_DISPATCH_TOKEN env var');

  const response = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/dispatches`, {
    method: 'POST',
    headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: eventType, client_payload: clientPayload }),
  });

  // GitHub answers 204 on success; 404 usually means the token can't see the repo.
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`GitHub dispatch failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
}
