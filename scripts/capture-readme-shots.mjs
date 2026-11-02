// Capture README screenshots from the browser preview (simulated IPC).
// Usage: node scripts/capture-readme-shots.mjs [baseUrl] [outDir]
// Prerequisite: `pnpm dev:browser` serving the Vite dev build (default port 1422).
// The browser preview shim provides deterministic mock data, so shots are
// reproducible without real native state. The preview banner is removed before
// capturing because it is a dev-only artifact, not product UI.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:1422";
const outDir = resolve(process.argv[3] ?? "docs/screenshots");

const shots = [
  { name: "home-fa-dark", route: "/", lang: "fa", mode: "dark" },
  { name: "home-en-dark", route: "/", lang: "en", mode: "dark" },
  { name: "learning-fa-dark", route: "/learning", lang: "fa", mode: "dark" },
  { name: "learning-en-light", route: "/learning", lang: "en", mode: "light" },
  { name: "connections-api-en-dark", route: "/connections/api", lang: "en", mode: "dark" },
  { name: "terminal-fa-dark", route: "/terminal", lang: "fa", mode: "dark" },
  { name: "workshop-fa-dark", route: "/workshop", lang: "fa", mode: "dark" },
];

const browser = await chromium.launch({
  channel: process.platform === "win32" ? "msedge" : undefined,
});

try {
  await mkdir(outDir, { recursive: true });
  for (const shot of shots) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 860 },
      deviceScaleFactor: 2,
      locale: shot.lang === "fa" ? "fa-IR" : "en-US",
      reducedMotion: "reduce",
    });
    await context.addInitScript(
      ([lang, mode]) => {
        localStorage.setItem(
          "vibehub.settings.v1",
          JSON.stringify({
            language: lang,
            themeMode: mode,
            onboardingDone: true,
          }),
        );
      },
      [shot.lang, shot.mode],
    );
    const page = await context.newPage();
    await page.goto(baseUrl + shot.route, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.getElementById("browser-preview-banner")?.remove();
      return document.fonts.ready;
    });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: resolve(outDir, `${shot.name}.png`),
      fullPage: false,
    });
    await context.close();
    console.log("captured", shot.name);
  }
} finally {
  await browser.close();
}
