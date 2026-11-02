Lesson 1 of 3 · Suggested time: 20–30 minutes with practice

By the end you can record two file versions and compare them.

## Get ready

Git records file history locally; GitHub hosts repositories online. You do not need a GitHub account here.

Install [Git for Windows — open in browser](https://git-scm.com/install/windows), reopen PowerShell, then check the installed version:

```powershell
git --version
```

Set your author name and email, replacing the examples. Commits expose these values; global settings affect other repositories too. This does not sign you into GitHub.

```powershell
git config --global user.name "Your Name"
```

```powershell
git config --global user.email "you@example.com"
```

## Create a practice folder

Choose a location outside real projects and create a new folder:

```powershell
mkdir git-practice
```

Enter it:

```powershell
cd git-practice
```

Initialize a repository on main:

```powershell
git init -b main
```

Open the file, type First note, save and close Notepad:

```powershell
notepad notes.txt
```

## Record the first version

Editing, staging and committing are separate steps. Staging selects a version of your changes for the next commit.

Check status; notes.txt should be untracked:

```powershell
git status
```

Stage that file:

```powershell
git add notes.txt
```

Record the first version locally; nothing is uploaded:

```powershell
git commit -m "Add first note"
```

## Compare a second version

Reopen the file, add a Second note line, and save:

```powershell
notepad notes.txt
```

Inspect the added line. Press q if a pager opens:

```powershell
git diff
```

Stage the second change:

```powershell
git add notes.txt
```

Record the second version:

```powershell
git commit -m "Add second note"
```

You should see two commits:

```powershell
git log --oneline
```

Compare the two recorded versions:

```powershell
git diff HEAD~1 HEAD -- notes.txt
```

## Try it yourself

Add a third line and inspect status and diff without committing. Is the third line in the latest commit? No: it is only in your local file. Review and commit it using the same steps before the next lesson. Git does not back up uncommitted work.

**[Next: lesson 2 — agent changes and GitHub](/learning/git-agent-github?category=git)**
