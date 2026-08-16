---
name: new-feature-small
description: Creates a new feature branch, implements the requested feature, commits, pushes and creates a PR with a title and description (if the user has responded positively to a prompt to do so, presented at the start of the workflow). Use this skill whenever the user asks to implement a new feature, add a new feature, or create a new feature branch. Trigger on: "implement a new feature", "add a new feature", "create a new feature branch".
model: sonnet
---
# New Feature Small

This skill will prompt the user for a feature name and the acceptance criteria of implementation, then:
- create a new branch (from main) called `feature/<feature-name>`, 
- add tests to cover the acceptance criteris
- implement the requested feature
- run test suite
- commit the changes
- push the branch, and open a PR with a title and description. 

The user will be prompted to confirm whether they want to open a PR after the feature is implemented.

## structuring the PR
The PR title should be formatted as: feat: <feature-name>.
The description should be formatted as follows:
- "Summary" a short bulleted summary of the feature and any relevant details
- "Test Cases" summary of implemented test cases and what they test (bullet point per each)
- "Manual Test"(if relevant) how to manual test it
- "Limitations" any known limitations, orcompromises that were made.

If the user does not want to open a PR, the branch will be pushed but no PR will be created.
`