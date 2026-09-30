import { expect, test } from "@playwright/test";

// Scenario 1 on a phone viewport: John Smith's F-150, Summit Towing's Workflow A, estimate → consent → tow → invoice → record.
test("customer-requested tow follows the company workflow from estimate to complete record", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Start scenario" }).first().click();

  // Who requested — operational, not a legal ruling.
  await expect(page.getByRole("heading", { name: "Who requested or initiated this tow?" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Vehicle owner \/ customer/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Continue" }).click();

  // Company-configured workflow.
  await expect(page.getByText("Summit Towing Ltd. workflow", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Customer-Requested Tow" })).toBeVisible();
  await expect(page.getByText("Workflow configured by Summit Towing Ltd.")).toBeVisible();
  await expect(page.getByText("Interview question")).toBeVisible();
  await page.getByRole("link", { name: "Continue" }).click();

  // Customer (prefilled by the scenario).
  await expect(page.getByLabel("Full name")).toHaveValue("John Smith");
  await page.getByRole("button", { name: "Save and continue" }).click();

  // Vehicle and job details.
  await expect(page.getByRole("heading", { name: "Vehicle and job details" })).toBeVisible();
  await page.getByRole("button", { name: "Use current location" }).click();
  await expect(page.getByLabel("Destination supplied / confirmed by")).toHaveValue("John Smith");
  await page.getByRole("button", { name: "Save and continue" }).click();

  // Estimate from the standard rate card: $125 + 14 km × $4.50 = $188 + GST $9.40.
  await expect(page.getByRole("heading", { name: "Estimate builder" })).toBeVisible();
  await expect(page.getByText("$197.40")).toBeVisible();
  await page.getByRole("button", { name: "Preview and send estimate" }).click();

  // Preview and delivery (simulated text).
  await expect(page.getByRole("heading", { name: "Your tow estimate" })).toBeVisible();
  await page.getByRole("button", { name: /Send by text/ }).click();
  await expect(page.getByText(/Text sent to \(403\) 555-0199/)).toBeVisible();
  await page.getByRole("link", { name: "Continue to consent" }).click();

  // Tow gate is locked until the consent step is done.
  await page.waitForURL(/\/consent$/);
  const jobUrl = page.url().replace(/\/consent$/, "");
  await page.goto(`${jobUrl}/tow`);
  await expect(page.getByText("Do not begin tow — consent missing.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Vehicle secured" })).toHaveCount(0);

  // Customer view: company wording, web acknowledgement.
  await page.goto(`${jobUrl}/consent`);
  await expect(page.getByText("Waiting for the customer — web acknowledgement")).toBeVisible();
  await page.getByRole("link", { name: "Open customer view on this device" }).click();
  await expect(page.getByRole("heading", { name: "Summit Towing Ltd. — Authorization / Consent" })).toBeVisible();
  await expect(page.getByText(/I, John Smith, am the owner of the vehicle/)).toBeVisible();
  await page.getByRole("button", { name: "I authorize this tow" }).click();
  await expect(page.getByText("Thank you — your response is recorded")).toBeVisible();

  // Consent evidence: facts, not legal conclusions.
  await page.goto(`${jobUrl}/consent`);
  await expect(page.getByText("Consent record captured")).toBeVisible();
  await expect(page.getByText("Customer web acknowledgement")).toBeVisible();
  await expect(page.getByText("Template version")).toBeVisible();
  await page.getByRole("link", { name: "Continue" }).click();

  // Ready to proceed → tow timestamps.
  await expect(page.getByText("Summit Towing Ltd. workflow complete — ready to proceed.")).toBeVisible();
  for (const step of ["Arrived", "Vehicle secured", "Departed", "Delivered"]) {
    await page.getByRole("button", { name: step, exact: true }).click();
  }
  await page.getByRole("link", { name: "Continue to invoice" }).click();

  // Invoice before payment.
  await expect(page.getByText("Pre-filled from this job")).toBeVisible();
  await expect(page.getByText("Record payment — issue invoice first")).toBeVisible();
  await page.getByRole("button", { name: "Issue invoice" }).click();
  await expect(page.getByText(/Invoice INV-\d+ issued/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Record payment" })).toBeVisible();

  // Complete job record and export package.
  await page.getByRole("link", { name: "Done — view job record" }).click();
  await expect(page.getByText("Job record complete")).toBeVisible();
  await page.getByRole("button", { name: "Export job record" }).click();
  await expect(page.getByText(/files ready/)).toBeVisible({ timeout: 10_000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download job record" }).click();
  expect((await download).suggestedFilename()).toMatch(/^Summit-Towing-Ltd-job-\d+\.zip$/);
});

test("dead-phone fallback leads to the company's paper process", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: /Open job #1042 delivery/ }).click();
  await page.getByRole("button", { name: /Customer's phone is dead/ }).click();
  await page.getByRole("button", { name: /Use Summit Towing Ltd.'s paper process/ }).click();
  await expect(page.getByRole("radio", { name: /Upload \/ photo of paper document/ })).toHaveAttribute("aria-checked", "true");
});

test("offline simulation shows the orange banner and disables text", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("switch", { name: /Simulate offline/ }).check({ force: true });
  await expect(page.getByText("Offline — job saved locally. Will sync when connection returns.")).toBeVisible();
});
