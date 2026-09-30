import { test, type Page } from "@playwright/test";

// Visual tour for design review, not a test: `SHOTS=<dir> npx playwright test --project=screens`.
const dir = process.env.SHOTS;
test.skip(!dir, "Set SHOTS to an output directory");

const phone = { width: 390, height: 844 };
const desktop = { width: 1366, height: 900 };

async function shot(page: Page, name: string) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test("tour", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize(phone);
  await page.goto("/");
  await shot(page, "00-app-chooser");
  await page.goto("/driver");
  await shot(page, "01-driver-home");
  await page.goto("/driver/jobs");
  await shot(page, "01b-driver-jobs");
  await page.goto("/driver/account");
  await shot(page, "01c-driver-account");
  await page.goto("/owner");
  await shot(page, "01d-owner-dashboard-phone");
  await page.goto("/owner/team");
  await shot(page, "01e-owner-team-phone");
  for (const n of ["1042", "1043"]) {
    await page.goto("/owner/jobs");
    await page.getByRole("link", { name: `#${n}` }).first().click();
    await page.waitForURL(/\/owner\/jobs\/[^/?]+$/);
    await page.goto((await page.getByRole("link", { name: "Customer's page" }).getAttribute("href"))!);
    await shot(page, `01f-customer-status-${n}`);
  }

  await page.goto("/demo");
  await page.getByRole("button", { name: "Start scenario" }).first().click();
  await shot(page, "02-request");
  await page.getByRole("button", { name: "Continue" }).click();
  await shot(page, "03-workflow");
  await page.getByRole("link", { name: "Continue" }).click();
  await shot(page, "04-customer");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.getByRole("button", { name: "Use current location" }).click();
  await shot(page, "05-vehicle");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await shot(page, "06-estimate");
  await page.getByRole("button", { name: "Preview and send estimate" }).click();
  await shot(page, "07-send");
  await page.getByRole("button", { name: /Send by text/ }).click();
  await page.getByRole("button", { name: /Customer's phone is dead/ }).click();
  await shot(page, "07b-sent-deadphone");
  await page.getByRole("link", { name: "Continue to consent" }).click();
  await page.waitForURL(/\/consent$/);
  const jobUrl = page.url().replace(/\/consent$/, "");
  await shot(page, "08-consent-waiting");
  await page.getByRole("button", { name: "Record another consent method" }).click();
  await page.getByRole("radio", { name: /Signature on driver/ }).click();
  await shot(page, "08b-consent-methods");
  await page.goto(`${jobUrl}/tow`);
  await shot(page, "09-tow-blocked");
  await page.goto(`${jobUrl}/consent`);
  await page.getByRole("link", { name: "Open customer view on this device" }).click();
  await shot(page, "10-customer-estimate");
  await page.getByRole("button", { name: "I authorize this tow" }).click();
  await page.goto(`${jobUrl}/consent`);
  await shot(page, "11-consent-evidence");
  await page.getByRole("link", { name: "Continue" }).click();
  await shot(page, "12-ready");
  await page.getByRole("button", { name: "Arrived", exact: true }).click();
  await page.getByRole("button", { name: "Vehicle secured", exact: true }).click();
  await page.getByRole("button", { name: "Destination changed" }).click();
  await shot(page, "13-tow-in-progress");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Departed", exact: true }).click();
  await page.getByRole("button", { name: "Delivered", exact: true }).click();
  await shot(page, "13b-delivered-notice");
  await page.getByRole("link", { name: "Continue to invoice" }).click();
  await page.getByRole("button", { name: /More Mileage/ }).click();
  await shot(page, "14-invoice-builder");
  await page.getByRole("button", { name: "Issue invoice" }).click();
  await shot(page, "15-invoice-issued");
  await page.getByRole("link", { name: "Done — view job record" }).click();
  await shot(page, "16-record-phone");
  const token = await page.getByRole("link", { name: "View" }).last().getAttribute("href");
  await page.goto(token!);
  await shot(page, "17-customer-invoice");

  await page.setViewportSize(desktop);
  await page.goto(jobUrl);
  await shot(page, "20-record-desktop");
  await page.getByRole("button", { name: "Export job record" }).click();
  await page.waitForTimeout(2000);
  await shot(page, "21-export");
  await page.goto(`${jobUrl}/audit`);
  await shot(page, "22-audit");
  await page.goto("/owner/jobs");
  await shot(page, "23-owner-jobs");
  await page.getByRole("link", { name: "#1041" }).click();
  await shot(page, "24-incomplete-desktop");
  await page.goto("/owner");
  await shot(page, "24b-owner-dashboard-desktop");
  await page.goto("/owner/team");
  await shot(page, "24c-owner-team-desktop");
  await page.goto("/owner/messages");
  await page.getByRole("button", { name: /^Vehicle delivered/ }).first().click();
  await shot(page, "24d-owner-messages");
  await page.goto("/owner/settings/notifications");
  await shot(page, "24e-owner-notifications");
  await page.goto("/demo");
  await shot(page, "25-demo");
  await page.getByRole("button", { name: /Start as the owner/ }).click();
  await shot(page, "26-admin");
  await page.goto("/owner/settings/consent");
  await shot(page, "27-admin-consent");
  await page.goto("/owner/settings/workflows");
  await shot(page, "28-admin-workflows");
  await page.goto("/owner/settings/rates");
  await shot(page, "29-admin-rates");
  await page.goto("/owner/settings/templates");
  await shot(page, "30-admin-templates");
  await page.goto("/demo");
  await page.getByRole("switch", { name: /Simulate offline/ }).check({ force: true });
  await page.setViewportSize(phone);
  await page.goto("/driver");
  await shot(page, "31-offline-driver-home");
});
