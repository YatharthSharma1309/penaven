import { expect, test } from "@playwright/test";

test.describe("public surfaces", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    if (process.env.NEXT_PUBLIC_AUTH_BYPASS === "true") {
      await expect(page.getByRole("link", { name: /open live demo/i }).first()).toBeVisible();
    } else {
      await expect(page.getByRole("link", { name: /sign in/i }).first()).toBeVisible();
    }
    await expect(page.getByText("Penaven").first()).toBeVisible();
  });

  test("sign-in redirects to dashboard when AUTH_BYPASS is enabled", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("help center index loads", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: /help centers/i })).toBeVisible();
  });

  test("unknown help slug returns not found", async ({ page }) => {
    const response = await page.goto("/help/does-not-exist-org");
    expect(response?.status()).toBe(404);
  });

  test("widget embed requires key", async ({ page }) => {
    const response = await page.goto("/widget/embed");
    expect(response?.status()).toBe(404);
  });

  test("widget embed loads with a valid key when configured", async ({ page }) => {
    test.skip(
      !process.env.DEMO_WIDGET_KEY,
      "Set DEMO_WIDGET_KEY to test widget embed rendering",
    );

    const response = await page.goto(
      `/widget/embed?key=${encodeURIComponent(process.env.DEMO_WIDGET_KEY!)}`,
    );
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("button", { name: /open support chat/i }),
    ).toBeVisible();
  });
});

test.describe("dashboard with AUTH_BYPASS", () => {
  test("dashboard is reachable", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Overview", exact: true }),
    ).toBeVisible();
  });

  test("help center lists seeded organization", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByText(/demo company/i)).toBeVisible();
  });

  test("knowledge page lists documents section", async ({ page }) => {
    await page.goto("/knowledge");
    await expect(
      page.getByRole("heading", { name: "Documents", exact: true }),
    ).toBeVisible();
  });

  test("analytics page loads", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: /inbox board/i })).toBeVisible();
  });
});
