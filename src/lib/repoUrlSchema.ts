import { z } from 'zod';
import { parseGithubRepoUrl, toGithubRepoUrl } from './github';

/** An epic's repo URL as API input: blank/null clears it, anything else must be a GitHub repo
 * URL and is stored normalized (`https://github.com/owner/name`). */
export const repoUrlSchema = z
  .string()
  .nullable()
  .transform((value, ctx) => {
    if (!value?.trim()) return null;
    const ref = parseGithubRepoUrl(value);
    if (!ref) {
      ctx.addIssue({ code: 'custom', message: 'Must be a GitHub repo URL, e.g. https://github.com/owner/repo' });
      return z.NEVER;
    }
    return toGithubRepoUrl(ref);
  });
