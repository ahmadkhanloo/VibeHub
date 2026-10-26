# Native backend validation, 2026-10-26

The Rust handler now registers all 24 commands declared by the desktop IPC bridge. Before this change, `corepack pnpm release:guard` reproduced the 23 missing-command failure. Registration coverage is a structural check, not full product acceptance.

## Implemented behavior

- Windows app detection returns one record for each of the six bundled app IDs. Desktop paths and activated Qoder version directories are checked; CLI executables are discovered on PATH.
- Plain launch uses the detected executable. RTL launch delegates to the bundled, existing adapters and verifies injector process ownership. State is saved under the app configuration directory; stopping an injector checks both PID and its command line. Stopping the injector does not promise immediate removal of styles already injected into an open app.
- Proxy profiles/configuration persist through a synchronized JSON store. Invalid profiles, dangling references and explicit direct profiles under require-proxy are rejected. Credentials use Windows Credential Manager, never settings JSON.
- Proxy TCP, protocol-handshake and HTTPS-request checks report separate outcomes. A connected TCP port does not establish SOCKS support. HTTP credentials are read from the vault. Authenticated SOCKS handshake negotiation is not supported by the handshake-only check; the full request check uses the HTTP client's SOCKS support.
- Provider tests use a vault key only for its matching service, bounded responses, TLS, timeouts and no redirects. Provider error bodies and credential values are not returned as diagnostics. A response counts as a model response only when it includes a completion message.
- Feed synchronization downloads bounded JSON from HTTPS or loopback HTTP, checks the index/version/IDs, and applies the shared strict Zod schemas before updating app/provider/offer data. Valid content is cached for offline use. Remote content cannot supply installation commands. Guide refresh is still pending; guides remain bundled.
- Terminal detection, Oh My Posh installation, checksum-pinned optional font installation, prompt application and undo have adapters. The prompt targets Windows PowerShell's CurrentUserAllHosts profile. Undo removes only the marked block and preserves later edits. It does not uninstall fonts or Oh My Posh.
- Doctor reports available prerequisites. Package installation rejects unaudited app/package combinations. The bundled app catalog currently uses official download/guide routes, not audited winget mappings. The previous `opencode-ai` button was removed: current [OpenCode v2 documentation](https://dev.opencode.ai/v2/docs/) identifies a different package and says Windows package managers are unsupported.

## Executed local checks

- `cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml`: nine integration tests passed. Includes a real temporary Windows Credential Manager roundtrip, settings replacement/corruption preservation, URL and proxy validation, rejected SOCKS handshake, and HTTP provider-error redaction using a loopback server.
- `./tests/native-windows.ps1`: fourteen assertions passed. Includes app-record shape, profile detection, theme idempotence, original backup, undo preserving later edits, malformed-block preservation, rejected font/app IDs and refusal to stop an unrelated PID. Profiles and fake prerequisites are isolated under a temporary directory; the real user profile is untouched.
- Workspace tests: 16 passed. TypeScript checks, frontend build, translation parity and bundled-content validation passed. The frontend retains its existing >500 kB chunk warning and seven identical-translation warnings.

## Remaining acceptance limits

Required-proxy app launches fail closed until app-specific proxy use is validated. Environment variables alone are not treated as proof of proxy enforcement. Authenticated child-process proxy launch is rejected to keep credentials out of process arguments/environment. Full live launch, real font/installer mutations, all proxy modes, real provider calls, guide refresh, clean Windows 10/11 installation, uninstall and signed updater failure/recovery scenarios remain unverified.

The production updater public key is still a placeholder. Live GitHub inspection found no repository Actions secrets or variables and no production environment. No signing material was generated or substituted for an owner-controlled release key. Do not publish a production tag while those prerequisites and the acceptance limits remain unresolved.

GitHub repository identity was checked as ID `1408902399` before its authorized rename from `ahmadkhanloo/AgentRTL` to `ahmadkhanloo/VibeHub`. GitHub Pages was enabled with `build_type=workflow`. Prior to changes, Actions was enabled, `main` was unprotected, no rulesets existed, and Pages/production environment endpoints returned 404. These observations used the existing Git credential helper without printing credential values. Historical successful CI/Release runs predate this migration and are not evidence for the new desktop build.
