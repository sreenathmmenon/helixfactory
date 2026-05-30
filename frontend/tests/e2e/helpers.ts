import type { Page } from "@playwright/test";

export function navButton(page: Page, name: string) {
  return page.locator(".hf-side-nav").getByRole("button", { name: new RegExp(`^${name}\\b`, "i") });
}

export async function openMoreNav(page: Page) {
  const more = page.locator(".hf-side-nav details.hf-nav-group");
  const isOpen = await more.evaluate((node) => (node as HTMLDetailsElement).open);
  if (!isOpen) await more.locator("summary").click();
}
