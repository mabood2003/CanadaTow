import { expect, test } from "@playwright/test";

// TowLedger Driver on a phone: own jobs only, separate sign-in, its own installable identity.

test("driver home shows only the signed-in driver's jobs and continues the job in progress", async ({ page }) => {
  await page.goto("/driver");
  await expect(page.getByText("Driver", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Terry's jobs" })).toBeVisible();
  await expect(page.getByText("Your job in progress")).toBeVisible();
  await expect(page.getByText(/#1042 · .*Honda Civic/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Continue:/ })).toBeVisible();

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "My jobs" }).click();
  await page.getByRole("radio", { name: "All" }).click();
  await expect(page.getByText(/#1040 ·/)).toBeVisible();
  await expect(page.getByText(/#1041 ·/)).toHaveCount(0); // Mike's job
  await expect(page.getByText(/#1043 ·/)).toHaveCount(0);
});

test("a driver can't open another driver's job", async ({ page }) => {
  await page.goto("/owner/jobs");
  await page.getByRole("link", { name: "#1043" }).first().click();
  await page.waitForURL(/\/owner\/jobs\/[^/?]+$/);
  const ownerUrl = page.url();
  await page.goto(ownerUrl.replace("/owner/", "/driver/"));
  await expect(page.getByRole("heading", { name: "Job #1043 belongs to Mike Chen" })).toBeVisible();
});

test("signing out of the driver app leaves the owner app signed in", async ({ page }) => {
  await page.goto("/driver/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Who's driving?" })).toBeVisible();

  // Owner app keeps its own session.
  await page.goto("/owner");
  await expect(page.getByRole("heading", { name: /Dana/ })).toBeVisible();

  // Invited driver accepts by signing in, and sees an empty job list.
  await page.goto("/driver");
  await page.getByRole("button", { name: /Jules Martin/ }).click();
  await expect(page.getByRole("heading", { name: "Jules's jobs" })).toBeVisible();
  await expect(page.getByText("No jobs yet.")).toBeVisible();
});

test("each app installs separately with its own manifest and icon", async ({ request }) => {
  for (const [base, name] of [
    ["/driver", "TowLedger Driver"],
    ["/owner", "TowLedger Owner"],
  ]) {
    const manifest = await (await request.get(`${base}/manifest.webmanifest`)).json();
    expect(manifest).toMatchObject({ name, id: base, start_url: base, scope: base, display: "standalone" });
    const icon = await request.get(`${base}/app-icon/192`);
    expect(icon.headers()["content-type"]).toContain("image/png");
  }
});
