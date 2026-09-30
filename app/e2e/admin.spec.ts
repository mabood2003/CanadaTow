import { expect, test, type Page } from "@playwright/test";

// TowLedger admin console (web): companies overview, onboarding, read-only support view, pause, message log.

async function signIn(page: Page) {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "TowLedger team sign-in" })).toBeVisible();
  await page.getByRole("button", { name: /Bilal Saad/ }).click();
  await expect(page.getByRole("heading", { name: "Companies on TowLedger" })).toBeVisible();
}

test("overview lists every company with its health", async ({ page }) => {
  await signIn(page);
  const row = (name: string) => page.getByRole("row", { name: new RegExp(name) });
  await expect(row("Summit Towing Ltd.")).toContainText("Pilot");
  await expect(row("Prairie Roadside Recovery Inc.")).toContainText("Pilot");
  await expect(row("Northgate Towing")).toContainText("Onboarding");
  await expect(row("Northgate Towing")).toContainText("Invite not accepted");
});

test("onboard a company; its owner signs in to the owner app", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Onboard company" }).click();
  await page.getByLabel("Company name").fill("Foothills Recovery Ltd.");
  await page.getByLabel("Business address").fill("1 Main St, Okotoks, AB");
  await page.getByLabel("Business phone").fill("(403) 555-0199");
  await page.getByLabel("Owner's name").fill("Alex Kim");
  await page.getByLabel("Owner's email").fill("alex@foothills.example");
  await page.getByLabel("Yard name").fill("Okotoks yard");
  await page.getByLabel("Yard address").fill("5 Industrial Rd, Okotoks");
  await page.getByRole("button", { name: "Create company and invite owner" }).click();

  await expect(page.getByRole("heading", { name: /Foothills Recovery Ltd\./ })).toBeVisible();
  await expect(page.getByText("Onboarding").first()).toBeVisible();
  await page.getByRole("radio", { name: "Messages" }).click();
  await expect(page.getByText("Email to alex@foothills.example")).toBeVisible();

  // The new owner opens TowLedger Owner, picks their company and name.
  await page.goto("/owner");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Company for the owner app").selectOption({ label: "Foothills Recovery Ltd." });
  await page.getByRole("button", { name: /Alex Kim/ }).click();
  await expect(page.getByRole("heading", { name: /Alex/ })).toBeVisible();
  await expect(page.getByText("Foothills Recovery Ltd.").first()).toBeVisible();
  await expect(page.getByText("0 on file")).toBeVisible();

  // Back in the admin console, the invite now shows as accepted and the onboarding is logged.
  await page.goto("/admin/activity");
  await expect(page.getByText(/Onboarded Foothills Recovery Ltd\. from the TowLedger starting template/)).toBeVisible();
});

test("support view is read-only and every look is logged", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Summit Towing Ltd." }).first().click();
  await expect(page.getByText("support view (read-only)", { exact: false })).toBeVisible();
  await page.getByRole("radio", { name: "Jobs" }).click();
  await page.getByRole("button", { name: /#1041/ }).click();
  await expect(page.getByRole("columnheader", { name: "Event" })).toBeVisible();

  await page.getByRole("radio", { name: "Admin activity" }).click();
  await expect(page.getByText("Viewed Summit Towing Ltd. — job #1041 record and audit trail")).toBeVisible();
  await expect(page.getByText("Viewed Summit Towing Ltd. — jobs")).toBeVisible();
});

test("pausing a company stops new tows in its apps", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Summit Towing Ltd." }).first().click();
  await page.getByLabel("Account status").selectOption("paused");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByText("Status changed to Paused.")).toBeVisible();

  await page.goto("/driver");
  await expect(page.getByText(/account is paused/).first()).toBeVisible();
  await page.getByRole("button", { name: /New Tow/ }).click();
  await expect(page.getByText(/new tows can't be started/).last()).toBeVisible();
});

test("message log shows texts and emails across companies", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Message log" }).click();
  await expect(page.getByText("Summit Towing Ltd.", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Northgate Towing", { exact: true }).first()).toBeVisible();
  await page.getByRole("combobox", { name: "Message type" }).selectOption("invite");
  await expect(page.getByText("Email to sandeep@northgatetowing.example")).toBeVisible();
});
