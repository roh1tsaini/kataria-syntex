import { test, expect } from "@playwright/test";

test.describe("Mobile Devices and Settings Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept as authenticated user
    await page.route("**/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user-1",
            phone: "+919876543210",
            name: "Rohit Saini",
            role: "admin",
          },
        }),
      }),
    );
    await page.route("**/auth/devices", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          devices: [
            {
              id: "dev-curr",
              label: "My Phone",
              platform: "android",
              userAgent: null,
              lastSeenAt: new Date().toISOString(),
              isCurrent: true,
            },
            {
              id: "dev-web",
              label: "Office Chrome",
              platform: "web",
              userAgent: "Mozilla/5.0",
              lastSeenAt: new Date().toISOString(),
              isCurrent: false,
            },
          ],
        }),
      }),
    );
  });

  test("renders settings screen with user info", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByText("Settings")).toBeVisible();
    await expect(page.getByText("Rohit Saini")).toBeVisible();
    await expect(page.getByText("+919876543210")).toBeVisible();
    await expect(page.getByText("Theme", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Manage signed-in sessions & QR login"),
    ).toBeVisible();
  });

  test("navigates to devices management screen", async ({ page }) => {
    await page.goto("/devices");

    await expect(page.getByText("Connected Devices")).toBeVisible();
    await expect(page.getByText("This device")).toBeVisible();
    await expect(page.getByText("Approve device")).toBeVisible();
  });

  test("opens the approve sheet with the login code contract and scan toggle", async ({
    page,
  }) => {
    await page.goto("/devices");

    await page.getByText("Approve device").click();

    await expect(page.getByText("Approve a device")).toBeVisible();
    await expect(
      page.getByText(
        "Make sure the code matches the other device, then approve.",
      ),
    ).toBeVisible();
    await expect(page.getByText("Login code")).toBeVisible();
    await expect(
      page.getByText(
        "Open the login page on the other device and scan its QR code, or enter the code shown below it.",
      ),
    ).toBeVisible();
    await expect(page.getByText("Approve login")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Scan QR with camera" }),
    ).toBeVisible();
  });
});
