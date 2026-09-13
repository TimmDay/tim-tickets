export interface GithubRepoRef {
  owner: string;
  name: string;
}

const GITHUB_REPO_URL = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/;

/** Parses a GitHub repo URL (`https://github.com/owner/name`, with or without scheme, `www.`,
 * `.git` or a trailing slash) into owner/name, or null if it isn't one. This is what makes an
 * epic's `repoUrl` "valid" for agent runs. */
export function parseGithubRepoUrl(url: string | null | undefined): GithubRepoRef | null {
  const match = url?.trim().match(GITHUB_REPO_URL);
  if (!match) return null;
  return { owner: match[1], name: match[2] };
}

export function toGithubRepoUrl({ owner, name }: GithubRepoRef): string {
  return `https://github.com/${owner}/${name}`;
}
