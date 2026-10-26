import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockNative } from "./mock";

test("search includes model services and targets selected provider without saving", async ({
  page,
}) => {
  await mockNative(page);
  await page.goto("/");
  await page.getByRole("searchbox").fill("NVIDIA");
  await page.getByRole("searchbox").press("Enter");
  await expect(page).toHaveURL(/search\?q=NVIDIA/);
  await page.getByRole("link", { name: /NVIDIA API Catalog/ }).click();
  await expect(page).toHaveURL(/models\?provider=nvidia-build/);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("combobox")).toHaveValue(
    "nvidia",
  );
  expect(
    await page.evaluate(() =>
      (window as any).__mock.calls.filter(
        (c: any) => c.cmd === "provider_connection_save",
      ),
    ),
  ).toHaveLength(0);
});
test("catalog tabs use URL for back and forward", async ({ page }) => {
  await mockNative(page);
  await page.goto("/discover");
  await page.getByRole("tab", { name: "IDEs", exact: true }).click();
  await page.getByRole("tab", { name: "CLI agents", exact: true }).click();
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "IDEs", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("link", { name: /Qoder/ })).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("tab", { name: "CLI agents", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
test("daily launch uses RTL once, saves success and remembers explicit normal choice", async ({
  page,
}) => {
  await mockNative(page);
  await page.goto("/");
  const run = page.getByRole("button", {
    name: "Run with RTL ZCode",
    exact: true,
  });
  await expect(run).toBeEnabled();
  await run.evaluate((el: HTMLButtonElement) => {
    el.click();
    el.click();
  });
  expect(
    await page.evaluate(() =>
      (window as any).__mock.calls.filter((c: any) => c.cmd === "launch_app"),
    ),
  ).toHaveLength(1);
  await expect(run).toBeDisabled();
  await page.reload();
  await page.getByLabel("Launch mode for ZCode").selectOption("normal");
  await page.getByRole("button", { name: "Run ZCode", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("vibehub.settings.v1")!)
            .launchModeByApp.zcode,
      ),
    )
    .toBe("normal");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Run ZCode", exact: true }),
  ).toBeEnabled();
});
for (const scenario of ["running", "stateError"])
  test("unsafe launch blocked: " + scenario, async ({ page }) => {
    await mockNative(page, scenario);
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Run with RTL ZCode", exact: true }),
    ).toBeDisabled();
  });
test("missing preferred RTL never silently launches normally", async ({
  page,
}) => {
  await mockNative(page, "missing");
  await page.goto("/");
  await page.getByLabel("Launch mode for ZCode").selectOption("rtl");
  await expect(
    page.getByRole("button", { name: "Run with RTL ZCode", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(() =>
      (window as any).__mock.calls.filter((c: any) => c.cmd === "launch_app"),
    ),
  ).toHaveLength(0);
});
test("failed launch does not overwrite preferred mode", async ({ page }) => {
  await mockNative(page, "launchFailed");
  await page.goto("/");
  await page
    .getByRole("button", { name: "Run with RTL ZCode", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("vibehub.settings.v1")!).launchModeByApp
          .zcode,
    ),
  ).toBeUndefined();
});
test("contextual proxy creates and assigns without leaving tool", async ({
  page,
}) => {
  await mockNative(page);
  await page.goto("/app/zcode");
  await page
    .getByTestId("tool-proxy")
    .getByRole("button", { name: "New profile" })
    .click();
  await page.getByLabel("Profile name", { exact: true }).fill("مسیر شخصی");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page).toHaveURL(/app\/zcode/);
  await expect(page.getByLabel("Proxy for this tool")).toContainText(
    "مسیر شخصی",
  );
  expect(
    await page.evaluate(() => (window as any).__mock.config.perApp.zcode),
  ).toMatch(/^p-/);
});
test("content cache clearing preserves preferences, credentials and native config", async ({
  page,
}) => {
  await mockNative(page);
  await page.goto("/settings");
  await page.evaluate(() =>
    localStorage.setItem("vibehub.content.v1", "cached"),
  );
  await page
    .getByRole("button", { name: "Wipe local cache", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("vibehub.content.v1")))
    .toBeNull();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("vibehub.settings.v1")!).language,
    ),
  ).toBe("en");
  expect(
    await page.evaluate(() =>
      (window as any).__mock.calls.filter(
        (c: any) => c.cmd === "provider_credentials_clear",
      ),
    ),
  ).toHaveLength(0);
});
test("bulk deletion confirms inventory and retries partial failure", async ({
  page,
}) => {
  await mockNative(page, "bulkPartial");
  await page.goto("/settings");
  await page.getByRole("button", { name: "Review items to delete" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Local Ollama");
  await dialog.getByRole("button", { name: "Delete listed items" }).click();
  await expect(
    dialog.getByRole("button", { name: "Retry remaining items" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Retry remaining items" }).click();
  await expect(dialog).not.toBeVisible();
});
test("model editor retains Persian draft when changing locale", async ({
  page,
}) => {
  await mockNative(page);
  await page.goto("/models");
  await page
    .getByRole("button", { name: "Add connection", exact: true })
    .click();
  await page.getByLabel("Display name").fill("اتصال آزمایشی");
  await page.evaluate(async () => {
    const i18n = await import("/src/i18n/index.ts");
    i18n.changeLanguage("fa");
  });
  await expect(page.getByLabel("نام دلخواه")).toHaveValue("اتصال آزمایشی");
  await expect(page.getByLabel("نام دلخواه")).toHaveAttribute("dir", "auto");
});
for (const scenario of ["ready", "empty", "failed", "partial"])
  test(
    "onboarding scan has explicit " + scenario + " state",
    async ({ page }) => {
      await mockNative(page, scenario, "en", false);
      await page.goto("/");
      expect(
        await page.evaluate(() =>
          (window as any).__mock.calls.filter(
            (c: any) => c.cmd === "detect_apps",
          ),
        ),
      ).toHaveLength(0);
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page.getByRole("button", { name: "Check this computer" }).click();
      await expect(page.locator("[data-scan-state]")).toHaveAttribute(
        "data-scan-state",
        scenario === "failed" ? "error" : scenario,
      );
    },
  );
test("dialogs cancel without writes and restore focus", async ({ page }) => {
  await mockNative(page);
  await page.goto("/models");
  const button = page.getByRole("button", {
    name: "Add connection",
    exact: true,
  });
  await button.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(button).toBeFocused();
  expect(
    await page.evaluate(() =>
      (window as any).__mock.calls.filter(
        (c: any) => c.cmd === "provider_connection_save",
      ),
    ),
  ).toHaveLength(0);
});
for (const lang of ["en", "fa"])
  test("accessible shell and main screens: " + lang, async ({ page }) => {
    await mockNative(page, "ready", lang);
    for (const route of [
      "/",
      "/discover",
      "/models",
      "/proxy",
      "/guides",
      "/settings",
      "/app/zcode",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1").first()).toBeVisible();
      await page.waitForFunction(() => document.fonts.status === "loaded");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        route,
      ).toEqual([]);
    }
  });
test("all 40 theme combinations keep normal text readable", async ({
  page,
}) => {
  await mockNative(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Run with RTL ZCode" }),
  ).toBeEnabled();
  const failures = await page.evaluate(() => {
    const linear = (x: number) => {
      x /= 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    const lum = (v: string) => {
      const c = v
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map(linear);
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    };
    const ratio = (a: string, b: string) => {
      const x = lum(a),
        y = lum(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const out: any[] = [];
    const root = document.documentElement;
    const button = document.querySelector(".vh-button-primary")!;
    for (const theme of ["graphite", "nord", "catppuccin", "solarized"])
      for (const mode of ["light", "dark"])
        for (const accent of ["auto", "indigo", "emerald", "violet", "amber"]) {
          Object.assign(root.dataset, { theme, mode, accent });
          const b = getComputedStyle(button);
          const s = getComputedStyle(root);
          const bg = s.getPropertyValue("--surface").trim();
          const probe = document.createElement("span");
          probe.style.color = bg;
          document.body.append(probe);
          const background = getComputedStyle(probe).color;
          probe.remove();
          const r = ratio(b.color, b.backgroundColor);
          if (r < 4.5) out.push({ theme, mode, accent, r });
          const text = document.createElement("span");
          text.style.color = "var(--muted)";
          document.body.append(text);
          const mr = ratio(getComputedStyle(text).color, background);
          text.remove();
          if (mr < 4.5) out.push({ theme, mode, accent, muted: mr });
        }
    return out;
  });
  expect(failures).toEqual([]);
});
test("desktop acceptance screenshots and no horizontal overflow", async ({
  page,
}) => {
  test.setTimeout(90000);
  await mockNative(page, "ready", "fa");
  for (const [width, height] of [
    [960, 640],
    [1280, 860],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    for (const route of [
      "/",
      "/discover",
      "/app/zcode",
      "/models",
      "/proxy",
      "/guides",
      "/settings",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1").first()).toBeVisible();
      await page.waitForFunction(() => document.fonts.status === "loaded");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route + " " + width,
      ).toBe(true);
      await page.screenshot({
        path:
          "output/ux-redesign/screens/" +
          width +
          "-" +
          (route.slice(1).replaceAll("/", "-") || "home") +
          ".png",
        animations: "disabled",
      });
    }
  }
});

test("validated catalog refresh updates an already mounted result list", async ({
  page,
}) => {
  await mockNative(page);
  await page.goto("/discover");
  await expect(page.getByRole("link", { name: /ZCode/ })).toBeVisible();
  await page.evaluate(async () => {
    const data = await import("/src/lib/catalog.ts");
    const apps = data.apps.map((app: any) =>
      app.id === "zcode" ? { ...app, name: "ZCode refreshed" } : app,
    );
    const guides: any = {};
    for (const app of apps)
      for (const lang of ["fa", "en"])
        guides[app.id + "/" + lang] = data.guideText(app.id, lang);
    const catalog = { apps, providers: data.providers, offers: [] };
    data.applyRemoteCatalog(
      catalog,
      data.validateRemoteGuides(guides, catalog),
    );
  });
  await expect(
    page.getByRole("link", { name: /ZCode refreshed/ }),
  ).toBeVisible();
});
test("required proxy failure never reports launch success or persists choice", async ({
  page,
}) => {
  await mockNative(page, "required");
  await page.goto("/");
  await page
    .getByRole("button", { name: "Run with RTL ZCode", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("vibehub.settings.v1")!).launchModeByApp
          .zcode,
    ),
  ).toBeUndefined();
  await expect(
    page.getByText("Launch request accepted", { exact: true }),
  ).toHaveCount(0);
});
test("reset preferences is explicit and preserves native connection inventory", async ({
  page,
}) => {
  await mockNative(page);
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Reset interface preferences", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("vibehub.settings.v1")!).onboardingDone,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Reset interface preferences", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset interface preferences", exact: true })
    .click();
  await expect(page).toHaveURL(/onboarding/);
  expect(
    await page.evaluate(() => (window as any).__mock.connections.length),
  ).toBe(1);
  expect(
    await page.evaluate(() =>
      (window as any).__mock.calls.filter(
        (c: any) =>
          c.cmd === "provider_credentials_clear" ||
          c.cmd === "proxy_set_config",
      ),
    ),
  ).toHaveLength(0);
});
test("single model deletion cancels without touching any connection", async ({
  page,
}) => {
  await mockNative(page);
  await page.goto("/models");
  await page
    .getByRole("button", { name: "Delete connection Local Ollama" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(page.getByTestId("connection-connection-local")).toBeVisible();
  expect(
    await page.evaluate(() =>
      (window as any).__mock.calls.filter(
        (c: any) => c.cmd === "provider_connection_delete",
      ),
    ),
  ).toHaveLength(0);
});
test("keyboard tabs follow RTL order and dialog Tab stays inside", async ({
  page,
}) => {
  await mockNative(page, "ready", "fa");
  await page.goto("/discover");
  const all = page.getByRole("tab", { name: "همه", exact: true });
  await all.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("tab", { name: "محیط‌های توسعه", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goto("/models");
  await page.getByRole("button", { name: "افزودن اتصال", exact: true }).click();
  await expect(page.getByLabel("نام دلخواه")).toBeFocused();
  const dialog = page.getByRole("dialog");
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
test("dark high DPI window preserves content and reduced motion", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    viewport: { width: 960, height: 640 },
    deviceScaleFactor: 1.5,
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await mockNative(page, "ready", "fa");
  await page.goto("http://127.0.0.1:1425/");
  await page.evaluate(() => {
    document.documentElement.dataset.mode = "dark";
  });
  await expect(
    page.getByRole("button", { name: "اجرای راست‌چین ZCode", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "output/ux-redesign/screens/dark-fa-high-dpi.png",
    animations: "disabled",
  });
  await ctx.close();
});
