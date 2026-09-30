import { expect, test } from "@playwright/test";

test("owner jobs list shows workflow columns and flags the job missing its invoice", async ({ page }) => {
  await page.goto("/owner/jobs");
  for (const h of ["Job ID", "Date", "Vehicle", "Driver", "Request type", "Workflow", "Estimate", "Consent", "Invoice", "Status"]) {
    await expect(page.getByRole("columnheader", { name: h })).toBeVisible();
  }
  await page.getByRole("combobox", { name: "Status" }).selectOption("attention");
  await expect(page.getByRole("link", { name: "#1041" })).toBeVisible();
  await expect(page.getByRole("link", { name: "#1040" })).toHaveCount(0);

  await page.getByRole("link", { name: "#1041" }).click();
  await expect(page.getByText("Needs attention: invoice not issued")).toBeVisible();
  await page.getByRole("link", { name: "Audit trail" }).click();
  await expect(page.getByText("Append-only: entries can't be edited or deleted")).toBeVisible();
});

test("owner saves a new consent template version; history keeps earlier versions", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: /Start as the owner/ }).click();
  await expect(page.getByText("Summit Towing Ltd. controls its forms, rates, wording and workflows.")).toBeVisible();

  await page.getByRole("navigation", { name: "Company setup" }).getByRole("link", { name: "Consent template" }).click();
  await expect(page.getByRole("heading", { name: "Consent Template — Version 3" })).toBeVisible();
  await expect(page.getByText("Your company controls and approves its consent wording.")).toBeVisible();
  await page.getByLabel("Button label").fill("I authorize");
  await page.getByRole("button", { name: "Save as Version 4" }).click();
  await expect(page.getByRole("heading", { name: "Consent Template — Version 4" })).toBeVisible();
  for (const v of ["V1", "V2", "V3", "V4"]) await expect(page.getByText(v, { exact: true })).toBeVisible();
});

test("owner maps a job category to a different workflow", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: /Start as the owner/ }).click();
  await page.getByRole("navigation", { name: "Company setup" }).getByRole("link", { name: "Job categories & workflows" }).click();
  await page.getByRole("combobox", { name: "Workflow for Private-property owner" }).selectOption({ label: "C — Police-Directed Tow" });
  await page.getByRole("button", { name: "Save workflows" }).click();
  await expect(page.getByText(/Saved. New jobs follow this configuration/)).toBeVisible();
});
