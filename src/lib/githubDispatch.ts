import { GithubRepoRef } from './github';

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
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ event_type: eventType, client_payload: clientPayload }),
  });

  // GitHub answers 204 on success; 404 usually means the token can't see the repo.
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`GitHub dispatch failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
}
