---
name: code-reviewer
description: Reviews the src/ of the current project and reports bugs, issues, and anything that looks risky or wrong. Use this skill whenever the user asks to review their code, check the codebase, or wants a code review. Trigger on: "review my code", "check the codebase", "look at src", "code review", "code audit", "review this".
model: sonnet
---
# Code Reviewer

Scan src/ and surface any real problems - bugs, security issues, performance issues, dead code, and anything that looks risky or wrong. Do not suggest code that has been deleted. Focus on the code in the current project.
If anything is found, create a new branch called refactor/code-reviewer and make the changes. If nothing is found, respond with "No issues found in src/".