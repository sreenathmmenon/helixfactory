import { expect, test } from "@playwright/test";
import { navButton } from "./helpers";

test("safety review page renders scenario controls", async ({ page }) => {
  await page.goto("/");
  await navButton(page, "Assess Change").click();

  await expect(page.getByRole("heading", { name: "Assess Change", exact: true })).toBeVisible();
  const plannedChange = page.getByRole("textbox", { name: "Planned change" });
  const changeTargets = page.getByRole("textbox", { name: "Change targets" });
  await expect(plannedChange).toBeVisible();
  await expect(changeTargets).toBeVisible();
  await expect(page.getByRole("button", { name: /Flask session\/cookie/i })).toBeVisible();

  await page.getByRole("button", { name: /Flask session\/cookie/i }).click();
  await expect(plannedChange).toHaveValue(/Flask session and cookie/);
  await expect(changeTargets).toHaveValue(/sessions.py/);
  await expect(page.getByRole("button", { name: "Run safety review" })).toBeDisabled();
});
