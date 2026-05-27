import type { Page } from "@playwright/test";

export function navButton(page: Page, name: string) {
  return page.locator(".hf-side-nav").getByRole("button", { name: new RegExp(`^${name}\\b`, "i") });
}
