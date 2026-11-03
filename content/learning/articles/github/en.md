Workshop lesson · Suggested time: 40–50 minutes with practice

By the end you can send the assistant's work to your own GitHub repository as commits.

## Get ready

GitHub hosts Git repositories; yesterday's local commits are the prerequisite here. You need a free account for GitHub: create one at [github.com](https://github.com/signup) and confirm your email.

Open your coding app on yesterday's practice repository; if you have none, finish [record your first change with Git](/learning/git-first-commit?category=git) first.

## Connect the repository to GitHub

First create an empty repository named `first-vibe` on GitHub; without a README or license so it does not clash with your local one. Then register the remote and push from the project terminal:

```powershell
git remote add origin https://github.com/<username>/first-vibe.git
git push -u origin main
```

Replace `<username>` with your own. The first push asks for authentication; sign in if a browser opens, or create a token from your GitHub account settings.

Checkpoint: the repository page in a browser shows your project files and yesterday's commits.

## Take the assistant's work to a commit

Now give a real request, for example: "Add an About section to the page." When the assistant finishes, you read the diffs and accept them:

```powershell
git add -A
git status
```

Take the commit message from the assistant's own explanation — the debugging lesson said the same:

```powershell
git commit -m "Add about section"
git push
```

Checkpoint: the repository's Commits tab shows the new commit, and the changed page is updated on GitHub.

## Apps and the GitHub plugin also work

Some apps ship a ready GitHub connection or plugin: the Plugins section in ChatGPT, `/plugins` and your configured marketplace in Codex CLI. Connected, the assistant can read issues or open pull requests; its access is your connected account's permissions. Install, removal, and troubleshooting live in [install and manage skills](/learning/skill-basics?category=skills).

The plugin does not replace local Git; both work at the same time.

## Try it yourself

Make one more small change, read the diff, commit, and push. Then open the Commits tab on GitHub: at one glance, you should be able to say what each commit changed. If a message is unclear, write your own rule now: "verb + what", like Add about section.

**[Next step: practice and find the right resources](/learning/git-practice-resources?category=git)**
