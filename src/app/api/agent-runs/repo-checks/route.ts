import { NextResponse } from 'next/server';
import { RepoAgentReadiness, repoKey } from '@/lib/agentRuns';
import { parseGithubRepoUrl } from '@/lib/github';
import { checkRepoAgentReadiness } from '@/lib/githubDispatch';

const MAX_REPOS = 20;

/**
 * Pre-flight for the "Release the bots" dialog: `?repo=owner/name&repo=...` → readiness per repo,
 * keyed by `repoKey`. The dispatch route runs the same check itself, so this is purely so the
 * dialog can warn before anything is sent.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams.getAll('repo');
  const repos = [...new Map(
    params
      .map((param) => parseGithubRepoUrl(`github.com/${param}`))
      .filter((repo) => repo !== null)
      .map((repo) => [repoKey(repo), repo] as const),
  ).values()];

  if (repos.length === 0 || repos.length > MAX_REPOS) {
    return NextResponse.json({ error: `Pass 1–${MAX_REPOS} repo=owner/name params` }, { status: 400 });
  }

  const entries = await Promise.all(repos.map(async (repo) => [repoKey(repo), await checkRepoAgentReadiness(repo)] as const));
  return NextResponse.json(Object.fromEntries(entries) satisfies Record<string, RepoAgentReadiness>);
}
