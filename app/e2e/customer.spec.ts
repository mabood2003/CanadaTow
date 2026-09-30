import { expect, test, type Page } from "@playwright/test";

// The customer's link on their phone: tow status with the estimate and invoice built in.

async function customerLink(page: Page, jobNumber: string) {
  await page.goto("/owner/jobs");
  await page.getByRole("link", { name: `#${jobNumber}` }).first().click();
  await page.waitForURL(/\/owner\/jobs\/[^/?]+$/);
  const href = await page.getByRole("link", { name: "Customer's page" }).getAttribute("href");
  expect(href).toMatch(/^\/c\//);
  return href!;
}

test("customer sees the tow on the way, with where the vehicle is now", async ({ page }) => {
  await page.goto(await customerLink(page, "1043"));
  await expect(page.getByRole("heading", { name: "Your vehicle is on the way" })).toBeVisible();
  await expect(page.getByText("On the way to Summit yard").first()).toBeVisible();
  await expect(page.getByText("Vehicle hooked up and secured")).toBeVisible();
  await expect(page.getByText("Next")).toBeVisible();
});

test("customer reviews and approves the estimate from the status page", async ({ page }) => {
  await page.goto(await customerLink(page, "1042"));
  await expect(page.getByRole("heading", { name: "Your estimate is ready to review" })).toBeVisible();
  await page.getByRole("button", { name: "Review and approve the estimate" }).click();
  await expect(page.getByRole("button", { name: "Estimate", pressed: true })).toBeVisible();
  await page.getByRole("button", { name: "I authorize this tow" }).click();
  await expect(page.getByText("Thank you — your response is recorded")).toBeVisible();

  await page.getByRole("button", { name: "Status" }).click();
  await expect(page.getByText("You approved the estimate")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review and approve the estimate" })).toHaveCount(0);
});

test("a completed tow shows delivery, the invoice and payment", async ({ page }) => {
  await page.goto(await customerLink(page, "1040"));
  await expect(page.getByRole("heading", { name: /Your vehicle was delivered to Ridgeline Auto Repair/ })).toBeVisible();
  await expect(page.getByText("Payment received — thank you")).toBeVisible();
  await page.getByRole("button", { name: /Invoice INV-/ }).click();
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
});
