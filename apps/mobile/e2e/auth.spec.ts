import { test, expect } from "@playwright/test";

test.describe("Mobile Auth Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept API calls so the Playwright suite runs hermetically
    await page.route("**/auth/me", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "unauthorized" } }),
      }),
    );
    await page.route("**/auth/qr/start", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: "TEST-CODE-1234",
          claimSecret: "test-secret",
          payload: "kataria://login/scan/TEST-CODE-1234",
          expiresIn: 300,
          expiresAt: new Date(Date.now() + 300000).toISOString(),
        }),
      }),
    );
    await page.route("**/auth/qr/poll*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "pending" }),
      }),
    );
    await page.route("**/auth/lookup", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          exists: true,
          hasPassword: true,
          registrationClosed: false,
        }),
      }),
    );
  });

  test("renders sign in screen on Pixel 7 viewport", async ({ page }) => {
    await page.goto("/auth");

    // Title and branding
    await expect(page.getByText("Kataria Syntex")).toBeVisible();
    await expect(page.getByText("Sign in")).toBeVisible();
    await expect(
      page.getByText("Enter your phone number or email, or scan the QR code."),
    ).toBeVisible();

    // Input field
    const input = page.getByPlaceholder("+91 98765 43210 or you@gmail.com");
    await expect(input).toBeVisible();

    // Tabs
    await expect(page.getByText("Phone / Email")).toBeVisible();
    await expect(page.getByText("Scan QR")).toBeVisible();
  });

  test("can switch to QR login tab", async ({ page }) => {
    await page.goto("/auth");

    const qrTab = page.getByText("Scan QR");
    await qrTab.click();

    await expect(page.getByText("Scan with a signed-in device.")).toBeVisible();
  });
});
