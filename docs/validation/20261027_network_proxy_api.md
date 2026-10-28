# VibeHub proxy and API verification — 2026-10-27

## Live network results

The production Rust proxy-test function was run against the existing loopback
listener `127.0.0.1:10808`, without changing proxy configuration or credentials.
All eight checks passed:

| Route | TCP | Protocol handshake | Real HTTPS request |
| --- | --- | --- | --- |
| Direct | not applicable | not applicable | PASS |
| System | not applicable | not applicable | PASS |
| HTTP, 127.0.0.1:10808 | PASS | PASS | PASS |
| SOCKS5, 127.0.0.1:10808 | PASS | PASS | PASS |

HTTPS requests used `https://example.com/` with normal certificate verification.
Raw redacted results: `output/network/live.json`.
These checks establish the hub's HTTP-client routing, not routing inside an IDE.

## API and proxy regression checks

Ten networking regression tests use actual loopback TCP servers and synthetic
credentials held only in memory. They cover:

- HTTP CONNECT split across packets, Basic authentication and HTTP 407 rejection.
- SOCKS5 with/without authentication, rejected authentication, and remote DNS.
- API requests actually carried through the selected HTTP proxy.
- Failed explicit proxies never falling back to a reachable direct destination.
- OpenAI-compatible, Anthropic and Gemini endpoint paths, JSON bodies and headers.
- Missing keys issuing no API request; Ollama sending no Authorization header.
- HTTP 401/429/500, invalid/empty responses, bounded response size and redaction.
- Redirects not forwarding requests/keys to a second endpoint.

All ten tests passed. Together with the existing four Rust checks, the normal
Rust suite passed **14 tests**, with the real-network test intentionally ignored
unless explicitly selected. The separately selected live test passed all eight
route checks above.

Eight targeted UI tests also passed, including API-test confirmation/cancellation,
the new local-authentication label, proxy assignment, provider/model editing,
required-proxy failure and English/Persian accessibility checks. TypeScript,
823 bilingual keys, IPC registration and all 27 Node tests passed.

## Corrections

The HTTP handshake previously used a single socket read, which could reject a
valid CONNECT status arriving in fragments. It now reads a bounded status line.
An invalid HTTP-200 model response no longer reports successful key
authentication. Empty model text is not treated as a usable response. Ollama
reports authentication as not required, rather than claiming a key was checked.
Missing stored proxy passwords fail explicitly. Keychain/client setup in async
API/proxy tests runs on background workers.

## External API acceptance remains open

No `proxy.json` or `provider-connections.json` was present in VibeHub's current
Roaming/Local application-data directories. No external provider API key was
supplied or fetched from other applications. Therefore production model calls
to OpenAI, Anthropic, Gemini and other providers are **not verified**. Local
protocol checks do not establish account eligibility, model availability, quota,
or real provider authentication. Ollama was not listening on its default port.

Reproduce network checks with `cargo test --manifest-path
apps/desktop/src-tauri/Cargo.toml --lib`. To explicitly run live checks, set
`VIBEHUB_LIVE_PROXY_PORT` and an absolute `VIBEHUB_NETWORK_REPORT` output path,
then select `network::tests::live_network_routes -- --ignored --nocapture`.

## Delivered installer

Official Tauri production build and NSIS packaging succeeded.

Artifact: release-artifacts/VibeHub-Setup.exe (27511091 bytes).

SHA-256: FF3E2EBAD5D2203F31D86E387EF0F92873FE8C519A193562AC3141DE90275D42
