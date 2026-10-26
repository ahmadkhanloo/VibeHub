# DeepSeek Harness RTL

> **Legacy adapter notice (2026-10-26):** this describes the preserved AgentRTL DeepSeek Harness RTL adapter. The old installer is not part of the VibeHub release, and replacement coverage is unverified. See the [release acceptance matrix](../../docs/validation/VibeHub_Release_Acceptance_Matrix.md).

Make Persian and other right-to-left text readable in DeepSeek Harness. The launcher starts the app with its local Chromium DevTools port, then injects a stylesheet into the chat. It also handles the composer, keeps English direction automatic, and leaves code blocks left-to-right. The bundled Vazirmatn font improves Persian glyph rendering.

See the [VibeHub source checkout guide](../../README.md) for the shared Windows installer. Choose **DeepSeek Harness RTL** in Setup. DeepSeek Harness and Node.js 21 or newer must already be installed.

Fully quit DeepSeek Harness before using its RTL shortcut. The launcher will explain if the app is already open without the debug port; it never closes the app for you.

The app-specific port is `9228` and may be changed with `DEEPSEEK_HARNESS_RTL_PORT`. Its injector lock uses the next port. The code is [MIT licensed](../../LICENSE); the bundled font is under SIL Open Font License 1.1 (`assets/OFL.txt`).
