# dsh-our-free-model: free model lanes (unofficial)

An unofficial plugin that brings current models — such as DeepSeek V4.1 Flash and Kimi K3 — into the Harness model picker without login, signup or an API key. Free lanes connect directly to public gateways, and optional account channels are also available.

## Install

Shared commands live in [DeepSeek Harness plugins](/learning/dsh-plugins-basics). The README's pinned install:

```bash
dsh plugin --profile web add @ebony-vinyl/dsh-our-free-model@2.8.5
```

Always check the version compatible with your Harness in the repository README. Version 2.8.5 is installed on the web profile on this machine.

## Use and basic commands

- After install and a Harness restart, lanes appear in the model picker.
- Plugin console — lane status, a usage dashboard and run logs.
- Quota window — one real 429 locks that lane for a default 6-hour window during which the plugin refuses new requests; "retry after changing egress" closes the window.
- Egress test — checks connectivity through a third-party echo without spending quota.
- Egress proxy — each lane can take its own `http`/`https`/`socks5` proxy, or the environment's `HTTP_PROXY`.
- A local OpenAI gateway with LAN forwarding is also included for other tools.

## Notes and warnings

- A free lane means public quota per egress IP; it is neither stable nor guaranteed. Free quota is not unlimited free API — the same warning as [DeepSeek web login](/learning/dsh-deepseek-web-login).
- Request bodies go to that lane's provider; do not use it for sensitive or confidential work.
- Account channels use your accounts on other services; respect those services' terms and know a channel can go offline at any time.
- It is third-party software; review the source, release notes and licenses before relying on it, and update with the shared guide's update command and a newer version.
