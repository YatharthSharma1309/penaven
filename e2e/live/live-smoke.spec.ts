import { expect, test } from "@playwright/test";

/**
 * Read-only checks of the deployed site (LIVE_BASE_URL, default
 * https://penaven.vercel.app). Every request is a GET or a page load. Nothing
 * here signs in, chats, submits a form or uploads.
 */

test("health check reports the database as connected", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe("ok");
  expect(body.database).toBe("connected");
});

test("landing page shows the Penaven wordmark", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("banner").getByText("Penaven", { exact: true })).toBeVisible();
});

test("landing page prices Pro at $39", async ({ page }) => {
  await page.goto("/");
  // The smallest block that holds both the plan name and its price.
  const pro = page
    .locator("div")
    .filter({ has: page.getByText("Pro", { exact: true }) })
    .filter({ hasText: "$39" })
    .last();
  await expect(pro).toBeVisible();
  await expect(pro).not.toContainText("$0");
});

for (const path of ["/demo/hiring", "/demo/hiring/compare", "/share/sample", "/help"]) {
  test(`${path} loads`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status(), `final status for ${path}`).toBe(200);
    await expect(page.locator("main, [role=main]").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Page not found" })).toHaveCount(0);
  });
}

test("sign-in loads (the Clerk form, or the demo's redirect into the workspace)", async ({ page }) => {
  const response = await page.goto("/sign-in");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Page not found" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/(sign-in|dashboard)/);
});

test("security headers are set", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["strict-transport-security"]).toContain("max-age=");
});

test("the widget page without a key is not found", async ({ request }) => {
  const response = await request.get("/widget/embed");
  expect(response.status()).toBe(404);
});
