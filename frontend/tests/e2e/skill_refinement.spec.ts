import { test, expect } from "@playwright/test";
import { navButton } from "./helpers";

test("skill refinement review page exposes proposal action", async ({ page }) => {
  await page.goto("/");
  await navButton(page, "Skills").click();
  await expect(page.getByRole("button", { name: /propose refinement/i })).toBeVisible();
});
