---
name: code-reviewer
description: Reviews the src/ of the current project and reports bugs, issues, and anything that looks risky or wrong. Use this skill whenever the user asks to review their code, check the codebase, or wants a code review. Trigger on: "review my code", "check the codebase", "look at src", "code review", "code audit", "review this".
model: sonnet
---
# Code Reviewer

Scan src/ and surface any real problems - bugs, security issues, performance issues, dead code, and anything that looks risky or wrong. Do not suggest code that has been deleted. Focus on the code in the current project.
If anything is found, create a new branch called refactor/code-reviewer and make the changes. If nothing is found, respond with "No issues found in src/".

## Opening a PR

If a GitHub remote is configured (`git remote -v` shows one), push the branch and open a PR automatically once the fixes are committed - no need to ask first, this is standing authorization for this specific action within this skill. Use `gh pr create`:

- Title: short (under 70 chars), starting with "refactor:", summarizing the fix theme (e.g. "fix: session expiry, drag-reorder data loss, batch write limits").
- Body: a `## Summary` section with one bullet per distinct issue fixed (file + one-sentence description), and a `## Test plan` section listing what was actually run (tsc/lint/build, and any manual verification). Follow the same format as the PR template in the top-level git instructions.
- For complex issues, follow the bullet points with a more in-deptch description of the issue being addressed. Include links to official docs if they are useful.
- Push with `git push -u origin refactor/code-reviewer` before calling `gh pr create`.

If no GitHub remote exists, skip the push/PR step and just report that the fixes are committed locally on `refactor/code-reviewer`.
