import { test, expect } from "@playwright/test";
import { navButton } from "./helpers";

test("repository ingestion and pre-mortem controls render", async ({ page }) => {
  await page.goto("/");
  await expect(navButton(page, "Ingest")).toBeVisible();
  await navButton(page, "Pre-mortem").click();
  await expect(page.getByLabel("Pre-mortem target")).toBeVisible();
});
