import { test, expect } from "@playwright/test";
import { navButton, openMoreNav } from "./helpers";

test("quickstart workflow navigation is available", async ({ page }) => {
  await page.goto("/");
  for (const name of ["Home", "Ingest", "Assess Change", "Impact", "Twin", "Audit"]) {
    await expect(navButton(page, name)).toBeVisible();
  }
  await expect(page.locator(".hf-side-nav summary", { hasText: "More" })).toBeVisible();
  await openMoreNav(page);
  for (const name of ["Pre-mortem", "Execution", "Q&A", "Security", "History", "Memory", "Skills"]) {
    await expect(navButton(page, name)).toBeVisible();
  }
});
