# ZCode RTL

> **Legacy adapter notice (2026-10-26):** this document covers the source-based AgentRTL RTL adapter, not the new VibeHub desktop installer. The old `AgentRTL-Setup` binaries are not VibeHub releases. VibeHub's public installer and replacement coverage remain unverified; see the [release acceptance matrix](../../docs/validation/VibeHub_Release_Acceptance_Matrix.md).

<p align="center">
  <img src="../../docs/hero.png" alt="Before: a Persian answer rendered LTR and scrambled. After: correct RTL — while code blocks stay LTR." width="100%">
</p>

<!--
GitHub About / description (copy into the repo "About" field):
Make ZCode chat render Persian, Arabic, Hebrew, Urdu — any RTL language — correctly. Per-paragraph auto-direction, code stays LTR. No app patching, survives updates, one-command install.
-->

Make [ZCode](https://z.ai) — Z.ai's AI coding IDE — render Persian (and any RTL language) correctly in its chat.

AI tools assume English. ZCode renders every message left-to-right, so Persian answers look scrambled: punctuation lands on the wrong side and English words jump around mid-sentence. **ZCode RTL fixes that with one CSS rule, injected at runtime — the app itself is never modified.**

نسخهٔ فارسی: [README.fa.md](README.fa.md)

## 🌍 Supported languages

Any right-to-left script — direction is detected per paragraph, so English text and code blocks are never touched:

**Persian (Farsi)** · **Arabic** · **Hebrew** · **Urdu** · **Dari** · **Kurdish** · **Pashto** · **Uyghur** · **Yiddish** · **Sindhi** …

## ✨ What you get

- **Auto RTL per paragraph** — each block follows its first strong character: Persian → RTL, English → LTR, even inside a single message
- **Mixed text handled** — Persian paragraphs containing English words, numbers and file paths stay readable
- **Code blocks stay LTR** — `pre`/`code` are deliberately excluded
- **Composer too** — the input box auto-switches direction while you type
- **Self-healing** — re-injects into reloaded pages and new windows automatically
- **Invisible** — runs hidden in the background: no console window, no taskbar entry
- **Lightweight & single-instance** — one local HTTP request every 2 s, a few MB of RAM; duplicates exit automatically

## 🆚 Why not just patch the app?

| Approach | The problem |
|---|---|
| Patching `app.asar` | Breaks on **every app update**, needs **admin rights**, can corrupt the install |
| Injecting CSS by hand in DevTools | Gone after **every reload or restart** |
| Copy-pasting answers elsewhere to read them | Leaves your workflow every time |
| Waiting for official RTL support | 🙂 |

ZCode RTL **touches nothing inside the app**: it uses the app's own Chromium DevTools port to inject one stylesheet at runtime. App updates don't affect it, no admin rights are needed, and uninstalling is one command.

## 🚀 Install

### Quick install — one step, done

**Windows legacy source install** — clone VibeHub and run the preserved adapter installer:

```powershell
git clone https://github.com/ahmadkhanloo/VibeHub.git
cd VibeHub
powershell -ExecutionPolicy Bypass -File install.ps1 -Apps zcode
```

**Linux / macOS legacy source install** — the script downloads the VibeHub source archive and installs the preserved adapter:

```bash
curl -fsSL https://raw.githubusercontent.com/ahmadkhanloo/VibeHub/main/install.sh | bash
```

These are legacy adapter instructions. They require Node.js ≥ 21 and do not claim that the adapter is included in a VibeHub public release.

### Professional install — review, customize, portable

Clone and inspect the source first, then install the preserved legacy adapter from this checkout:

```bash
git clone https://github.com/ahmadkhanloo/VibeHub.git
cd VibeHub
# worth a look: injector.mjs, launch.vbs / launch.sh, install.ps1 / install.sh
powershell -ExecutionPolicy Bypass -File install.ps1   # Windows
bash install.sh                                        # Linux / macOS
```

What professionals get:

- **Custom DevTools port** — set `ZCODE_RTL_PORT` (default `9222`) in the environment before using the launcher; app and injector both follow it.
- **Run from source** — the launcher works from any folder, so a git checkout can be the install location itself.
- **Uninstall** — the source-checkout PowerShell command stops its injector and removes only its shortcut; an existing installation of the retired AgentRTL Setup can be removed through *Settings → Apps*. On Linux/macOS, `bash install.sh --uninstall` removes the ZCode RTL copy.

Requirements (all platforms): [ZCode official site](https://zcode.z.ai/) and download path; the optional [ZCode invite](https://zcode.z.ai/invite/CF3ZEFJR) is separate. The legacy source adapter also requires **Node.js ≥ 21** on PATH (its built-in WebSocket is used).

## ▶️ Use

Fully quit ZCode (also from the system tray), then start it with the new **ZCode RTL** launcher — the desktop shortcut on Windows, the applications-menu entry (and desktop icon) on Linux, `ZCode RTL.app` on macOS. That's it — Persian messages now render RTL.

> The debug port only exists when ZCode is started through the shortcut, so use the shortcut instead of the normal icon.

## 🧰 Troubleshooting

- **Still LTR?** ZCode was started from the normal icon. Close it completely and start via **ZCode RTL**.
- **Worked before, stopped after an update?** The updater relaunched ZCode without the port. Same fix: close fully → start via the shortcut.
- **Is it running?** Windows: Task Manager → look for `node.exe` (the hidden injector). Linux/macOS: `pgrep -f injector.mjs`.
- **Uninstall:** source checkout on Windows: `powershell -ExecutionPolicy Bypass -File install.ps1 -Uninstall`; existing legacy Setup installation: remove **AgentRTL Legacy RTL Adapters** through *Settings → Apps*; Linux/macOS: `bash install.sh --uninstall`.

## 🔒 Security note

While ZCode runs via the shortcut it exposes a DevTools port (`127.0.0.1:9222`) that **any local process** can reach. It is localhost-only, but keep it in mind on shared machines.

## ⚙️ How it works

A launcher starts ZCode with `--remote-debugging-port=9222` and launches a ~100-line Node script (`injector.mjs`) that connects to the Chromium DevTools Protocol and injects one CSS rule into every window. The launcher is `launch.vbs` on Windows (run through `wscript.exe`, so no console window ever appears) and `launch.sh` on Linux/macOS. New windows are injected in real time via the DevTools `targetCreated` event — the polling loop is only a safety net:

```css
:is(p, li, h1, h2, h3, blockquote, td, textarea, ...) {
  unicode-bidi: plaintext; /* direction = first strong character */
  text-align: start;
}
```

`plaintext` lets every paragraph pick its own direction, so one message can contain a Persian paragraph and an English one — each rendered correctly. Code blocks are excluded and stay LTR.

## License

[MIT](../../LICENSE) — the bundled [Vazirmatn](https://github.com/rastikerdar/vazirmatn) font (used in the banner) is under the [SIL Open Font License 1.1](../../docs/fonts/OFL.txt).
