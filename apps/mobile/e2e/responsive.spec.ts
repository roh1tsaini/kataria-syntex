import { test, expect } from "@playwright/test";

test.describe("Mobile Responsive Layout", () => {
  test("fits within Pixel 7 mobile viewport without horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/auth");

    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth,
    );

    // No horizontal scrollbar
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
