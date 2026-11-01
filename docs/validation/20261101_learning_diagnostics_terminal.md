# Learning, diagnostics and Persian terminal — 2026-11-01

## Delivered behavior

- Expanded sidebar links no longer repeat their visible names in tooltips. Collapsed icons retain tooltips and accessible names.
- One Learn entry covers the learning home and legacy guide URLs. Common workflow and RTL setup are collected in the learning home; the repetitive RTL setup section is omitted from individual guide readers. Original sourced Markdown remains intact and reachable from the full-tutorial link. App-specific installation, model and compatibility instructions remain in place.
- Diagnostics displays five groups before execution: prerequisites, installed apps, RTL components, proxy configuration and saved model connections. Groups finish independently, errors remain visible, and reruns clear previous results. Saved configuration checks do not claim to test live model/proxy traffic.
- Terminal tools offers an optional, confirmed RtlTerminal installation and a Persian sample. Users open PowerShell inside this separate host to obtain shaping, rather than applying an encoding-only profile patch. Installation does not change the default terminal or PowerShell profile. Windows administrator consent is required by the upstream installer; uninstall remains available through Windows Installed apps.

## Evidence

- `pnpm check`: passed for all three workspace packages.
- `pnpm test`: 49 tests passed.
- `pnpm build`: passed; existing large-chunk warning remains.
- `pnpm i18n:check`: parity passed, 1174 keys; two existing product-name identity warnings remain.
- `pnpm release:guard`: every declared IPC command registered.
- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml --lib`: passed; dependency future-incompatibility warning for proc-macro-error2 remains.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/persian-terminal.ps1`: passed. Isolated mocks check checksum rejection before execution, installer exit failure, success only after detection, temporary-file cleanup and preservation of an existing installation. No installer is executed by this test.
- `& ./tests/native-windows.ps1` in PowerShell 7: 39 assertions passed, with the real user profile untouched. Invoking this existing suite under Windows PowerShell 5.1 fails because that runtime lacks ProcessStartInfo.StandardInputEncoding; the PowerShell 7 run succeeds.
- `pnpm exec playwright test tests/ui/learning-diagnostics-terminal.spec.ts --reporter=list`: 5 passed.
- `pnpm exec playwright test tests/ui/journey.spec.ts tests/ui/workbench.spec.ts tests/ui/workbench-redesign.spec.ts tests/ui/learning-library.spec.ts --grep-invert 'offers survive' --reporter=list`: 15 passed.
- Inspected screenshots under `output/playwright/consolidated-*` for Persian and English at 320/1280px, including terminal installation UI. No horizontal page overflow in those checks.
- Independent read-only code review returned no actionable issues. `git diff --check` passed.

## Known limits

- The initial broader UI run encountered an outdated assertion in `journey.spec.ts`: “offers survive corrupt read-state storage…” expected the notification switch to be absent while Offers.tsx explicitly renders it. Release preparation on 2026-11-02 updates the assertion to require the switch to be visible and off, retaining the check that entry never requests notification permission. Product behavior is unchanged.
- No RtlTerminal installation, live PowerShell rendering test, packaged installer build, publication or release was performed. Browser samples and mocked installation do not prove rendering inside an installed terminal or compatibility with every interactive CLI.
- RtlTerminal is an optional separate host, not a shaping patch to Windows Terminal or the IDE terminal. Text alignment is not a requirement of this feature.

## Pinned upstream installer

[RtlTerminal v1.1.4](https://github.com/mirbehnam/RtlTerminal/releases/tag/v1.1.4), asset `RtlTerminal-Setup-1.1.4-x64.exe`.

SHA-256 from the GitHub release asset API: `b9f60b9761fb7410994fcb33293111e012c1d79256e5bcfab0b4d62d16b4a096`.

The download URL and digest are fixed in the native adapter. A mismatch fails before launching the installer. [Upstream renderer documentation](https://github.com/mirbehnam/RtlTerminal/blob/main/docs/renderer.md) describes Persian/Arabic shaping; it is upstream evidence, not a local live verification.
