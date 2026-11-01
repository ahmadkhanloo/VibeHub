# Learning library release and live model checks — 2026-11-01

## Published build

`v0.2.2-beta.1` was built from main commit `035af9a603bae290d9701be525d2c2080f1a978c` after PR #19 passed all CI jobs. Local verification included 48 Node tests, 99 browser tests, and both complete locked Rust suites (40 passing tests each, with opt-in tests excluded). Clean Windows 10/11 acceptance remains open; this is a prerelease.

The public content feed was checked: nine apps, eleven extension guides, four document skills in the documents topic, and the DeepSeek Web login entry.

The release workflow downloaded all public assets and verified their checksums and updater signatures. Its final HTTP check falsely failed because `Invoke-WebRequest.Content` for an octet-stream download was a byte array, which was piped directly into `ConvertFrom-Json`. The published JSON was valid. The corrected step explicitly decodes UTF-8 and passed independently against the unchanged public manifest, archives and signature files. The fix does not rewrite any published binary or signature.

## Real model and account checks

- Claude Code 2.1.273 is installed. A saved-login flag was not treated as sufficient authentication evidence.
- The existing AMD Radeon Token Factory credential returned HTTP 200 for model listing and a tiny direct inference.
- Actual LiteLLM SDK 1.97.0 translated an Anthropic-format request to AMD's OpenAI-compatible endpoint and received a real response.
- **Official LiteLLM Proxy end to end:** Claude Code → authenticated loopback Proxy → AMD → `Qwen3.8-Flash-Next`; streamed result `OFFICIAL_PROXY_OK`, CLI exit 0. Proxy callback confirmed the actual upstream model. API duration: 15224 ms; 111 input and 26 output tokens. An earlier SDK diagnostic adapter completed in 6510 ms; neither sample guarantees future speed.
- The native opt-in read-only account test passed: Qoder identity and live usage were verified; ZCode identity and granted entitlements were verified, but remaining balance was unavailable.

The selected [AMD Token Factory service](https://amd-aim.github.io/radeon-cloud-docs/guides/token-factory/) is documented as free with daily caps for trial/development, not production. CLI cost estimates had an unknown cost basis and are not evidence of provider charges.

## Limits and local changes

The original direct Claude-to-AMD configuration returned HTTP 400 for system-message ordering; the LiteLLM OpenAI translation route succeeded. Official Proxy imports required isolated FastAPI 0.136.3 / Starlette 1.0.1 instead of the incompatible system FastAPI 0.141.1. Optional dependencies were installed only in a task-specific TEMP folder; the shared Python environment was not upgraded or downgraded.

Chat streaming was tested. File edits, tool calls, all model combinations and production reliability were not. No account was switched or signed out, no new signup/login flow was performed, and no persistent Claude settings were overwritten. Existing credentials were used only locally and were neither printed nor committed. Test proxy services were stopped afterwards. No DeepSeek Web plugin credential was present at its documented path, so a fresh interactive DeepSeek login was not tested.
