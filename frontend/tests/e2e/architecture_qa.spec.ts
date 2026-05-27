import { test, expect } from "@playwright/test";
import { navButton } from "./helpers";

test("architecture qa page accepts plain English questions", async ({ page }) => {
  await page.goto("/");
  await navButton(page, "Q&A").click();
  await expect(page.getByLabel("Architecture question")).toBeVisible();
});
