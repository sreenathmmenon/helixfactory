import { test, expect } from "@playwright/test";
import { navButton } from "./helpers";

test("execution workflow shows status inputs", async ({ page }) => {
  await page.goto("/");
  await navButton(page, "Execution").click();
  await expect(page.getByLabel("Ticket summary")).toBeVisible();
});
