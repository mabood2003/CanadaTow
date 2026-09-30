import { expect, test } from "@playwright/test";

// TowLedger Owner: runs on a laptop (desktop project) and a phone (owner-phone project).

test("dashboard shows what needs attention and who's on the road", async ({ page }) => {
  await page.goto("/owner");
  await expect(page.getByRole("heading", { name: /Dana/ })).toBeVisible();

  const attention = page.locator("section", { has: page.getByRole("heading", { name: "Needs attention" }) });
  await expect(attention.getByText(/#1041/)).toBeVisible();
  await expect(attention.getByText("Invoice not issued")).toBeVisible();

  const live = page.locator("section", { has: page.getByRole("heading", { name: "On the road now" }) });
  await expect(live.getByText("Mike Chen · #1043")).toBeVisible();
  await expect(live.getByText("Terry Boyd · #1042")).toBeVisible();

  // Tile → jobs list with the filter applied.
  await page.getByRole("link", { name: /Needs attention 1/ }).click();
  await expect(page).toHaveURL(/\/owner\/jobs\?status=attention/);
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("attention");
  await expect(page.getByRole("link", { name: "#1041" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "#1040" })).toHaveCount(0);
});

test("fix-it from the dashboard lands on the job's invoice step inside the owner app", async ({ page }) => {
  await page.goto("/owner");
  await page.getByRole("link", { name: "Fix it" }).first().click();
  await expect(page).toHaveURL(/\/owner\/jobs\/[^/]+\/invoice$/);
  await expect(page.getByRole("button", { name: "Issue invoice" })).toBeVisible();
});

test("team screen shows each driver's live job and filters jobs by driver", async ({ page }) => {
  await page.goto("/owner/team");
  await expect(page.getByText("#1043 · On the road")).toBeVisible();
  await expect(page.getByText("Invited")).toBeVisible(); // Jules

  await page.getByLabel("Name").fill("Sam Ortiz");
  await page.getByLabel("Email").fill("sam@summittowing.example");
  await page.getByRole("button", { name: "Send invite", exact: true }).click();
  await expect(page.getByText("Sam Ortiz")).toBeVisible();

  await page.getByRole("link", { name: "View jobs" }).first().click();
  await expect(page).toHaveURL(/\/owner\/jobs\?driver=/);
});

test("owner can run a tow themselves without leaving the owner app", async ({ page, isMobile }) => {
  await page.goto("/owner");
  if (isMobile) await page.getByRole("button", { name: "New tow" }).click();
  else await page.getByRole("navigation", { name: "Owner" }).getByRole("button", { name: "New tow" }).click();
  await expect(page).toHaveURL(/\/owner\/jobs\/[^/]+\/request$/);
  await expect(page.getByRole("heading", { name: "Who requested or initiated this tow?" })).toBeVisible();
});
