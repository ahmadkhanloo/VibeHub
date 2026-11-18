# find-skills: finding the right skill

Before writing a new skill, check whether a ready one exists for the job. find-skills makes searching the open skills ecosystem easy for you and the agent.

## What it gives you

Search skills by the work you want done (not an exact name), see the most-installed options, and get a ready install command. The reference index lives at skills.sh.

## Search and install

```bash
npx skills find react performance
npx skills add vercel-labs/agent-skills@react-best-practices -g
```

Vet three things before installing: install count (prefer 1,000+), source reputation (official sources like `vercel-labs` and `anthropics` are more trustworthy), and the source repository's stars. Treat anything under 100 installs with skepticism.

## Real limits

An installed skill only gives the agent text guidance: it runs no tools and guarantees nothing about its own correctness. Skills install per machine under `.agents/skills`; after installing, try one small real task with the skill to confirm it fits your workflow.
