# Launch lifecycle and browser-preview correction — 2026-10-28

The user confirmed the reported ZCode relaunch problem occurred at the browser preview on port 1422. That preview previously accepted simulated launches and stored `phase: running`. Closing the real Windows application could never reset that in-memory fixture. Displaying an ordinary launch button therefore suggested functionality that was not connected.

The preview now disables launch buttons, labels the applications as previews, and explains that launches require the desktop app. Its transport rejects `launch_app`, `launch_editor` and `stop_rtl`, including direct calls. Existing native transports remain untouched, even when loaded from a browser-mode development server. Preview screenshots are in `output/playwright/browser-launch-desktop-only.png`.

Independent code inspection identified two desktop recovery defects, reproduced before correction:

- Retry returned early for a cached running/unknown state without checking the current native status. Retry now checks the current state before deciding whether to launch; it still refuses running apps and uses the existing per-app in-flight guard.
- An owned RTL injector could outlive the app, while native status treated injector liveness as app liveness. Status now also requires a main application process in the same Windows session. It does not stop the app or injector. A missing injector still permits the existing launcher to repair the RTL session.

Returning focus/visibility refreshes active/recoverable launch states without rediscovering installed applications. Concurrent focus checks coalesce through the existing batch guard. An explicit status recheck is available for windows that do not emit focus changes, and stale already-open errors clear after idle is confirmed. Launch preferences are still stored only after a successful launch.

Validation:

- Three new native lifecycle assertions reproduced the orphan-injector defect and now pass; they are included in the existing native Windows suite. That suite's 36 assertions also pass under PowerShell 7. The suite requires .NET's `StandardInputEncoding` and is not invoked through Windows PowerShell 5.1.
- Browser preview/native-transport, close-and-return, stale retry, explicit status refresh, localized launch errors and polling checks passed. Of the 12 targeted UI cases, one search-focus CSS assertion failed during concurrent verification and passed when rerun alone; no search styling was changed.
- TypeScript, production build, 978-key translation parity and all 33 Node tests passed. The existing main-bundle-size warning remains.
- No real user application was opened, closed or restarted to run these regressions. The desktop recovery scenarios use controlled native/IPC fixtures; a live desktop relaunch was not claimed.

All changes are in `D:\Github\VibeHub`. Port 1422 remains a preview; use `pnpm dev:desktop` from this checkout for real app launch/RTL testing. No installer or published release was updated.
