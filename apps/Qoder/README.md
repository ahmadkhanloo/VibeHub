# Qoder RTL

> **Legacy adapter notice (2026-10-26):** this document covers the source-based AgentRTL Qoder adapter. The old AgentRTL Setup is not a VibeHub release, and replacement coverage in the new public installer has not been verified. See the [release acceptance matrix](../../docs/validation/VibeHub_Release_Acceptance_Matrix.md).

<!--
GitHub About / description (copy into the repo "About" field):
Make Qoder chat render Persian, Arabic, Hebrew, Urdu — any RTL language — correctly. Per-paragraph auto-direction, code stays LTR. No app patching, survives updates.
-->

Make [Qoder](https://qoder.com/) — the agentic AI coding IDE — render Persian (and any RTL language) correctly in its chat.

AI tools assume English. Qoder renders every message left-to-right, so Persian answers look scrambled: punctuation lands on the wrong side and English words jump around mid-sentence. **Qoder RTL fixes that with one stylesheet, injected at runtime — the app itself is never modified.**

نسخهٔ فارسی: [README.fa.md](README.fa.md)

## 🌍 Supported languages

Any right-to-left script — direction is detected per paragraph, so English text and code blocks are never touched:

**Persian (Farsi)** · **Arabic** · **Hebrew** · **Urdu** · **Dari** · **Kurdish** · **Pashto** · **Uyghur** · **Yiddish** · **Sindhi** …

## ✨ What you get

- **Auto RTL per paragraph** — each block follows its first strong character: Persian → RTL, English → LTR, even inside a single message
- **Mixed text handled** — Persian paragraphs containing English words, numbers and file paths stay readable
- **Code stays LTR** — `pre`/`code`, the terminal, the editor, the file tree and the tab strip are deliberately carved out
- **Composer too** — the input box auto-switches direction while you type
- **Every frame covered** — Qoder renders chat inside iframes and webviews, so the injector attaches to pages *and* nested targets, not just the top window
- **Vazirmatn included** — the font is embedded as base64 `@font-face`, so Persian glyphs look right without installing anything
- **Self-healing** — re-injects into reloaded pages, new windows and navigations automatically
- **Invisible** — a desktop shortcut that opens Qoder with no console window flashing, injector hidden in the background
- **Verifiable** — `doctor.mjs` proves the rules are actually live instead of you squinting at the chat

## 🆚 Why not just patch the app?

| Approach | The problem |
|---|---|
| Patching `app.asar` | Breaks on **every app update**, needs **admin rights**, can corrupt the install |
| Injecting CSS by hand in DevTools | Gone after **every reload or restart** |
| Copy-pasting answers elsewhere to read them | Leaves your workflow every time |
| Waiting for official RTL support | 🙂 |

Qoder RTL **touches nothing inside the app**: it uses Qoder's own Chromium DevTools port to inject one stylesheet at runtime. App updates don't affect it and no admin rights are needed.

## 🚀 Install

Windows only. Older Qoder releases install under `%LOCALAPPDATA%\Programs\Qoder`; newer releases use `%LOCALAPPDATA%\Programs\Qoder IDE`. The RTL launcher detects both layouts.

### Quick install — one step, done

```powershell
git clone https://github.com/ahmadkhanloo/VibeHub.git
cd VibeHub
powershell -ExecutionPolicy Bypass -File install.ps1 -Apps qoder
```

That creates a **Qoder RTL** shortcut on your Desktop, wearing Qoder's own icon. Nothing is copied elsewhere, no registry key and no startup entry is added.

Want to see what it would do first? Add `-WhatIf` — it prints the shortcut path, target and icon without touching anything.

### Professional install — review, customize, run from source

```bash
git clone https://github.com/ahmadkhanloo/VibeHub.git
cd VibeHub
# worth a look: style.mjs (the CSS), injector.mjs (CDP client), start.ps1 (the launcher)
```

- **Run from source** — `install.ps1` keeps the files where they are and the shortcut points at this folder, so a git checkout *is* the install. Moving or renaming the folder later means running `install.ps1` once from the new location.
- **Custom DevTools port** — set `QODER_RTL_PORT` (default `9225`) before launching; Qoder, the injector and `doctor.mjs` all follow it. The injector locks itself to `port + 1` so a second copy exits instead of double-injecting.
- **Uninstall** — for a source checkout, `powershell -ExecutionPolicy Bypass -File install.ps1 -Uninstall` removes its shortcut and stops its injectors; the checkout stays in place. If installed with Setup, uninstall **AgentRTL** through Settings → Apps.

| Variable | Default | What it does |
|---|---|---|
| `QODER_RTL_PORT` | `9225` | DevTools port; the injector's lock sits one port above |
| `QODER_RTL_EXE` | auto-detected | Full path to `Qoder.exe` or `Qoder IDE.exe`, if you keep it somewhere unusual |

When using the legacy AgentRTL Setup, select Qoder RTL and choose the executable with Browse on the next page if automatic detection fails or Qoder is installed in a custom location. The selected path is saved for future launches.

Version detection picks only a folder under `.qoder-versions\` that actually contains `resources\app.asar`; a version holding `app.asar.qoder-pending` is a staged update that cannot start, so it is skipped instead of picked by "highest version number".

Requirements: [Qoder](https://qoder.com/download) installed on Windows and **Node.js ≥ 21** on PATH (its built-in WebSocket is used).

## ▶️ Use

**Fully quit Qoder first — the window *and* the tray icon** — then start it from the **Qoder RTL** shortcut. That's it: Persian messages now render RTL.

The single-instance lock in Qoder is not tied to a profile folder, so a second launch just hands over to the running one and the debug port never opens. If Qoder is already up without the port, the shortcut tells you that instead of pretending to work; `The shortcut asks you to close Qoder and launch it again if it is already running without the debug port.

> The debug port only exists when Qoder is started through the shortcut, so use the shortcut instead of the normal icon.

## 🔬 Verify

No guesswork needed — `doctor.mjs` talks to the same DevTools port and reports what the page actually looks like:

```
node doctor.mjs --targets   # which targets are visible (pages, iframes, webviews)
node doctor.mjs --probe     # the real Persian text nodes and their parent classes
node doctor.mjs --check     # assert: is the Persian paragraph right-aligned? (exit 1 if not)
node doctor.mjs --shot      # before/after PNG of the chat area
```

`--check` is the one to trust: it measures the first glyph's distance from the right edge and confirms Vazirmatn loaded, and exits non-zero when any frame fails. Add `--verbose` for the raw JSON.

## 🧰 Troubleshooting

- **Still LTR?** Qoder was started from its normal icon. Close it completely — tray included — and start via **Qoder RTL**.
- **Worked before, stopped after an update?** The updater relaunched Qoder without the port. Same fix: close fully → start via the shortcut.
- **Shortcut does nothing visible?** In `-Gui` mode the launcher reports through message boxes, and every decision is logged to `%TEMP%\qoder-rtl.log` (launcher) and `%TEMP%\qoder-rtl-injector.out.log` / `.err.log` (injection).
- **Is the injector running?** Task Manager → look for `node.exe`. To stop only the injector:

  ```powershell
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match 'injector\.mjs' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId }
  ```

- **Qoder not found by the launcher?** Select `Qoder.exe` or `Qoder IDE.exe` with Browse in Setup, or set `QODER_RTL_EXE` to the full executable path.
- **Uninstall:** use the source-checkout command above, or uninstall **AgentRTL** through Settings → Apps if you used Setup.

## 🔒 Security note

While Qoder runs via the shortcut it exposes a DevTools port (`127.0.0.1:9225`) that **any local process** can reach — full read and write access to the IDE's windows. It is localhost-only, but keep it in mind on shared machines or close Qoder when you are done.

## ⚙️ How it works

The shortcut runs `launch.vbs` through `wscript.exe` (a GUI process, so no console window ever appears), which starts a hidden PowerShell launcher, `start.ps1`. The launcher resolves the active Qoder build, starts it with `--remote-debugging-port=9225`, waits for the port, then launches `injector.mjs` hidden.

The injector connects to the Chromium DevTools Protocol and asks for automatic session attachment with `Target.setAutoAttach { flatten: true }`, which yields a session per page **and** per iframe/webview target; inside each session it injects into every execution context and re-injects on navigation via `Page.addScriptToEvaluateOnNewDocument`. A 5-second sweep is only the safety net:

```css
:is(p, li, h1, h2, h3, blockquote, td, label, ...) , textarea, [contenteditable="true"] {
  unicode-bidi: plaintext; /* direction = first strong character */
  text-align: start;
}
:is(pre, code, ...) /* plus terminal, editor, tree, tabs */ {
  unicode-bidi: isolate !important;
  text-align: initial !important;
}
```

`plaintext` lets every paragraph pick its own direction, so one message can contain a Persian paragraph and an English one — each rendered correctly. The stylesheet is applied both as an adopted `CSSStyleSheet` and as a `<style id="qoder-rtl-fix-v3">` twin, so it survives content-security-policy checks on either path. The versioned style ID lets an upgrade replace CSS that an older running Qoder session may still inject after reload.

## License

[MIT](LICENSE) — the bundled [Vazirmatn](https://github.com/rastikerdar/vazirmatn) font is under the [SIL Open Font License 1.1](assets/OFL.txt).
