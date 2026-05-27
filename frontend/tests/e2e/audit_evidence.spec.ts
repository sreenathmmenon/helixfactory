import { test, expect } from "@playwright/test";
import { navButton } from "./helpers";

test("audit evidence page exposes evidence package action", async ({ page }) => {
  await page.goto("/");
  await navButton(page, "Audit").click();
  await expect(page.getByRole("button", { name: /load evidence/i })).toBeVisible();
});
