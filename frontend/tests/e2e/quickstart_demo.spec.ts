import { test, expect } from "@playwright/test";
import { navButton } from "./helpers";

test("quickstart workflow navigation is available", async ({ page }) => {
  await page.goto("/");
  for (const name of ["Home", "Ingest", "Twin", "Pre-mortem", "Execution", "Q&A", "Review", "Security", "Audit", "History", "Memory", "Skills"]) {
    await expect(navButton(page, name)).toBeVisible();
  }
});
