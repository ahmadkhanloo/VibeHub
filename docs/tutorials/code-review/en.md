# Review code with an agent

## From change to release

Local checks → AI review → Security → Tests and build → Human approval → Staged release → Monitor and rollback

## 1. Before the pull request

Run the project tests, type checks and build; keep their output. Write a short CLAUDE.md with project commands and conventions. Then run /code-review and /security-review in Claude Code.

## 2. Write review rules

In REVIEW.md, specify important failures, sensitive paths and what to skip. Ask for a file, line and reason for each finding. Move recurring issues into rules or lint checks.

## 3. On every pull request

Enable automated code and security review and CI checks. Fix each finding or resolve it with a reason. Record testing, risk and rollback steps in the PR description.

## 4. Match approval to risk

Start with strict rules. Require human review and branch protection for sensitive areas such as authentication, billing, CI and releases. A bot cannot replace a required human approval; reassess approval after new commits.

## 5. Release and monitor

Where available, use a merge queue, feature flags and staged releases. Keep rollback fast. Turn incidents and reverts into reviewer evaluation cases, and track their rates alongside review time.

## 6. Keep review convergent

After three review rounds, step back and reassess the approach. In later rounds review only new changes and avoid repeating findings.

## Review prompt

> Review the current changes against the request and surrounding code. Report real bugs, security risks and untested behavior with file, line and reason. Show test output and review limitations; omit cosmetic findings. Do not merge any change without my review.

[Source: Claude Code team article](https://claude.dev/blog/solving-code-review-at-anthropic/)
