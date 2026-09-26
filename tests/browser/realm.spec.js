import { test, expect } from "@playwright/test";
import fs from "node:fs";
const snapshot = JSON.parse(
  fs.readFileSync("data/repos.json", "utf8").replace(/^\uFEFF/, ""),
);
test.beforeEach(async ({ page }) => {
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill({ json: snapshot.repos }),
  );
});
test("loads projects, filters archives, searches and exposes safe links", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".project-card")).toHaveCount(6);
  await page.locator("#search").fill("Accidentes");
  await expect(page.locator(".project-card")).toHaveCount(1);
  await expect(page.locator(".card-meta a")).toHaveAttribute(
    "href",
    "https://github.com/Mundrack/Proyecto_IA_Accidentes",
  );
  await page.locator("#search").fill("");
  await page.getByRole("button", { name: "Reliquias", exact: true }).click();
  await expect(page.locator("#empty-projects")).toBeVisible();
  expect(errors).toEqual([]);
});
test("3D battle advances, pauses, anchors small labels, finishes and replays", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await expect(page.locator("#start-battle")).toBeEnabled();
  await page.locator("#start-battle").click();
  await expect(page.locator("#realm")).toHaveClass(/battle-active/);
  await page.clock.runFor(20000);
  await expect(page.locator(".fallen-label").first()).toBeAttached();
  await page.locator("#pause").click();
  const progress = await page
    .locator("#timeline-progress")
    .getAttribute("style");
  await page.clock.runFor(2000);
  expect(await page.locator("#timeline-progress").getAttribute("style")).toBe(
    progress,
  );
  await page.locator("#pause").click();
  await page.clock.runFor(32000);
  await expect(page.locator("#finale")).toBeVisible();
  await page.locator("#replay").click();
  await expect(page.locator("#realm")).toHaveAttribute(
    "data-phase",
    "approach",
  );
  await expect(page.locator("#finale")).toBeHidden();
  await page.locator("#skip-scene").click();
  await expect(page.locator("#realm")).toHaveAttribute("data-phase", "finale");
});
test("mobile keeps every project and has no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".project-card")).toHaveCount(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await expect(page.locator(".project-card").last()).not.toHaveCSS(
    "display",
    "none",
  );
});
test("reduced motion bypasses the battle, including keyboard navigation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#start-battle")).toBeEnabled();
  await page.locator("#start-battle").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#finale")).toBeVisible();
  await expect(page.locator("#pause")).toBeHidden();
  await expect(page.locator("#finale a")).toBeFocused();
});
test("API failure loads local snapshot and labels it accurately", async ({
  page,
}) => {
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill({ status: 403, json: { message: "Rate limit exceeded" } }),
  );
  await page.goto("/");
  await expect(page.locator(".project-card")).toHaveCount(6);
  await expect(page.locator("#data-status")).toContainText("copia local");
});
