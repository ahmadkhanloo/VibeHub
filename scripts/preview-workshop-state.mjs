// One-off preview shots of the workshop changes (not committed).
// Usage: node scripts/preview-workshop-state.mjs [baseUrl] [outDir]
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:1422";
const outDir = resolve(process.argv[3] ?? "output/preview");

const shots = [
  {
    name: "1-workshop-page",
    route: "/workshop",
    init: { language: "fa", themeMode: "dark", onboardingDone: true },
  },
  {
    name: "2-workshop-mode-sidebar",
    route: "/",
    init: { language: "fa", themeMode: "dark", onboardingDone: true, workshopMode: true },
  },
  {
    name: "3-progress-checked",
    route: "/learning?category=git",
    init: {
      language: "fa",
      themeMode: "dark",
      onboardingDone: true,
      progress: { "getting-started": true, "git-first-commit": true, "first-project": true },
    },
  },
  {
    name: "4-lesson-reader-done",
    route: "/learning/git-first-commit?category=git",
    init: {
      language: "fa",
      themeMode: "dark",
      onboardingDone: true,
      progress: { "git-first-commit": true },
    },
  },
  {
    name: "5-settings-toggle",
    route: "/settings",
    init: { language: "fa", themeMode: "dark", onboardingDone: true },
  },
];

const browser = await chromium.launch({ channel: "msedge" });
try {
  await mkdir(outDir, { recursive: true });
  for (const shot of shots) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 860 },
      deviceScaleFactor: 2,
      locale: shot.init.language === "fa" ? "fa-IR" : "en-US",
      reducedMotion: "reduce",
    });
    await context.addInitScript(
      ([init]) => {
        const { progress, ...settings } = init;
        localStorage.setItem("vibehub.settings.v1", JSON.stringify(settings));
        if (progress) localStorage.setItem("vibehub.progress.v1", JSON.stringify(progress));
      },
      [shot.init],
    );
    const page = await context.newPage();
    await page.goto(baseUrl + shot.route, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.getElementById("browser-preview-banner")?.remove();
      return document.fonts.ready;
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(outDir, `${shot.name}.png`) });
    await context.close();
    console.log("captured", shot.name);
  }
} finally {
  await browser.close();
}
