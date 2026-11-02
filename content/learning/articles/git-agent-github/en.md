Lesson 2 of 3 · Suggested time: 25–35 minutes with practice

By the end you can review assistant changes, commit on a branch, and send them to GitHub.

## Local work with an agent

Continue in the practice folder. Inspect the starting state and review and commit earlier edits separately before new work:

```powershell
git status
```

Create an independent practice branch:

```powershell
git switch -c practice/agent-note
```

Verify the current branch is practice/agent-note:

```powershell
git branch --show-current
```

Add an explanatory line to notes.txt yourself or with an assistant. Read the diff and inspect the file in your editor; run relevant tests in a real project:

```powershell
git diff
```

Stage only the reviewed file:

```powershell
git add notes.txt
```

Inspect exactly what the commit will contain:

```powershell
git diff --staged
```

Commit with a specific message:

```powershell
git commit -m "Clarify practice notes"
```

Example assistant request:

> Make the requested change, explain why, report the checks, and prepare the diff for review. Commit or push only when I ask.

A `.gitignore` file lists untracked files to ignore, such as `.env`; it does not remove previously tracked files or history. Do not commit passwords or keys.

## Sending and collaborating on GitHub

Create an empty test repository named git-practice on GitHub without a README or other initial files. Follow [official authentication guidance — open in browser](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github); Git author settings do not sign you in.

Replace the URL with your repository URL; this adds a destination called origin:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/git-practice.git
```

Check the destination before sending:

```powershell
git remote -v
```

Publish the base branch:

```powershell
git push -u origin main
```

Publish the practice branch; -u sets its upstream tracking relationship:

```powershell
git push -u origin practice/agent-note
```

Fetch downloads remote history; pull downloads and integrates it into the current branch; push sends local commits. Review local changes before pulling; integration can create conflicts.

On GitHub, open a Pull Request from practice/agent-note to main, review the diff, then merge after review. [Code review](/learning/code-review) is optional further reading.

A GitHub AI plugin is an account-authorized connection; it does not replace Git or reviewing changes.

## When something goes wrong

- Accidentally staged a file: `git restore --staged notes.txt` preserves edits.
- Unwanted local edit: inspect the diff first. `git restore notes.txt` discards uncommitted edits to that file; use it only when you want to discard them.
- Incorrect published commit: `git revert HEAD` creates a compensating commit; first confirm HEAD is the intended commit. Save and close the commit-message editor when it opens.
- Conflict: stop and inspect status and conflicting files. Understand both changes before accepting anything; consult the next lesson's troubleshooting resources.

**[Next: lesson 3 — practice and resources](/learning/git-practice-resources?category=git)**

[Previous lesson](/learning/git-first-commit?category=git)
