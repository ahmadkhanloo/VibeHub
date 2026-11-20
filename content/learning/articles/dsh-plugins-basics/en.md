# DeepSeek Harness plugins: shared install and management

Every Harness plugin shares one path for install, update and removal. This page shows those generic commands once; each plugin's article only covers its own specifics.

## Profiles

Plugins install onto profiles: `desktop` for the desktop app and `web` for the web UI. The `--profile` flag selects which. Each profile lives at `~/.dsh/profiles/<name>/`.

## Install, update, remove

```bash
dsh plugin --profile desktop add <package>
dsh plugin --profile desktop update <package>@latest
dsh plugin --profile desktop remove <package>
```

These commands forward the arguments verbatim to pnpm inside the profile folder. For the web UI, use the same commands with `--profile web`. A package source can be an npm name (`dsh-context`), a GitHub address (`github:<owner>/<repo>`), or a local archive (`file:<path to tgz>`).

You can also install without the terminal: open Settings → Plugin Market (or Add plugin), search the plugin name and install.

## After install

Restart Harness so new bundles load. A profile's installed plugins are visible in that profile's `package.json` under `dsh.profile.bundles`; `dsh plugin --profile desktop why <package>` explains why a package is present.

## Before installing an unofficial plugin

Read the source, check the version compatible with your Harness in Releases or the README, and know what data the plugin accesses and where it sends it. The plugins introduced in this app each have their own article:

- [dsh-deepseek-web-login: DeepSeek web login](/learning/dsh-deepseek-web-login)
- [dsh-context: see the conversation context](/learning/dsh-context)
- [dsh-squeeze: read long material](/learning/dsh-squeeze)
- [dsh-playwright: a real browser](/learning/dsh-playwright)
- [dsh-workspace-hygiene: workspace tidiness](/learning/dsh-workspace-hygiene)
- [dsh-subagent-model-router: a model per delegated task](/learning/dsh-subagent-model-router)
- [dsh-our-free-model: free model lanes](/learning/dsh-our-free-model)

For host compatibility, prerequisites and safe removal of skills, also see [Install and manage skills](/learning/skill-basics).
