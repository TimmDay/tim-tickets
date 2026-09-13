import { describe, expect, it } from 'vitest';
import { parseGithubRepoUrl } from '../github';

describe('parseGithubRepoUrl', () => {
  it.each([
    'https://github.com/timmday/tim-tickets',
    'github.com/timmday/tim-tickets',
    'https://www.github.com/timmday/tim-tickets/',
    'https://github.com/timmday/tim-tickets.git',
  ])('parses %s', (url) => {
    expect(parseGithubRepoUrl(url)).toEqual({ owner: 'timmday', name: 'tim-tickets' });
  });

  it.each(['', null, 'https://gitlab.com/a/b', 'https://github.com/timmday', 'https://github.com/a/b/tree/main'])(
    'rejects %s',
    (url) => {
      expect(parseGithubRepoUrl(url)).toBeNull();
    },
  );
});
