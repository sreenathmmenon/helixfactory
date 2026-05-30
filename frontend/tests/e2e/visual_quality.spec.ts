import { expect, test } from "@playwright/test";
import { navButton, openMoreNav } from "./helpers";

const pages = [
  { name: "Home", heading: "HelixFactory Control Plane" },
  { name: "Ingest", heading: "Ingest" },
  { name: "Twin", heading: "Twin" },
  { name: "Impact", heading: "Impact" },
  { name: "Pre-mortem", heading: "Pre-mortem" },
  { name: "Execution", heading: "Execution" },
  { name: "Q&A", heading: "Q&A" },
  { name: "Review", heading: "Review" },
  { name: "Security", heading: "Security" },
  { name: "Audit", heading: "Audit" },
  { name: "History", heading: "History" },
  { name: "Memory", heading: "Memory" },
  { name: "Skills", heading: "Skills" },
];

const secondaryPages = new Set(["Pre-mortem", "Execution", "Q&A", "Review", "Security", "History", "Memory", "Skills"]);

test.describe("enterprise visual quality", () => {
  for (const viewport of [
    { width: 1440, height: 1000, name: "desktop" },
    { width: 390, height: 900, name: "mobile" },
  ]) {
    test(`no horizontal overflow or broken primary surfaces on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const consoleErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });

      await page.goto("/");
      for (const item of pages) {
        if (secondaryPages.has(item.name)) await openMoreNav(page);
        await navButton(page, item.name).click();
        await expect(page.getByRole("heading", { name: new RegExp(item.heading) }).first()).toBeVisible();
        await expect(page.locator(".hf-app-shell")).toBeVisible();

        const metrics = await page.evaluate(() => {
          const overflowing = Array.from(document.querySelectorAll("body *"))
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              const style = window.getComputedStyle(element);
              if (style.position === "fixed" || rect.width === 0 || rect.height === 0) return false;
              return rect.left < -2 || rect.right > window.innerWidth + 2;
            })
            .slice(0, 5)
            .map((element) => ({
              tag: element.tagName,
              className: String((element as HTMLElement).className),
              left: Math.round(element.getBoundingClientRect().left),
              right: Math.round(element.getBoundingClientRect().right),
              viewport: window.innerWidth,
            }));
          return {
            scrollWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
            overflowing,
          };
        });

        expect(metrics.scrollWidth, `${item.name} scroll width`).toBeLessThanOrEqual(metrics.viewportWidth + 2);
        expect(metrics.overflowing, `${item.name} overflowing elements`).toEqual([]);
      }

      expect(consoleErrors).toEqual([]);
    });
  }
});
