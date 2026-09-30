import { expect, test } from "@playwright/test";

// Delivered → the customer is told automatically, after an undo window the driver can use.

test("delivered notice counts down, can be cancelled, re-sent, and shows in Messages", async ({ page }) => {
  // #1043 (private-property tow, on the road) — add the owner's contact first.
  await page.goto("/owner/jobs");
  await page.getByRole("link", { name: "#1043" }).first().click();
  await page.waitForURL(/\/owner\/jobs\/[^/?]+$/);
  const jobUrl = page.url();

  await page.goto(`${jobUrl}/customer`);
  await page.getByLabel("Full name").fill("Sam Lee");
  await page.getByLabel("Phone").fill("(403) 555-0111");
  await page.getByRole("button", { name: "Save and continue" }).click();

  await page.goto(`${jobUrl}/tow`);
  await page.getByRole("button", { name: "Delivered", exact: true }).click();
  await expect(page.getByText(/Sending in \d+ seconds/)).toBeVisible();
  await expect(page.getByText(/was delivered to Summit yard/)).toBeVisible();

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Delivery notice cancelled by Dana Whitford")).toBeVisible();

  await page.getByRole("button", { name: "Send delivery notice" }).click();
  await expect(page.getByText("Sam notified of delivery")).toBeVisible();

  await page.goto("/owner/messages");
  await page.getByRole("combobox", { name: "Message type" }).selectOption("delivered");
  await expect(page.getByRole("button", { name: /^Vehicle delivered Sent Text to \(403\) 555-0111 · job #1043/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Vehicle delivered Cancelled Text to \(403\) 555-0111 · job #1043/ })).toBeVisible();
  await page.getByRole("combobox", { name: "Message status" }).selectOption("cancelled");
  await expect(page.getByRole("button", { name: /^Vehicle delivered Sent/ })).toHaveCount(0);

  // Tap a message to read exactly what the customer got.
  await page.getByRole("button", { name: /^Vehicle delivered Cancelled/ }).click();
  await expect(page.getByText(/cancelled by Dana Whitford/)).toBeVisible();
});

test("the notice goes out on its own when the undo window ends", async ({ page }) => {
  await page.goto("/owner/settings/notifications");
  await page.getByRole("radio", { name: "15 seconds" }).click();

  await page.goto("/owner/jobs");
  await page.getByRole("link", { name: "#1043" }).first().click();
  await page.waitForURL(/\/owner\/jobs\/[^/?]+$/);
  const jobUrl = page.url();
  await page.goto(`${jobUrl}/customer`);
  await page.getByLabel("Full name").fill("Sam Lee");
  await page.getByLabel("Phone").fill("(403) 555-0111");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.goto(`${jobUrl}/tow`);
  await page.getByRole("button", { name: "Delivered", exact: true }).click();
  await expect(page.getByText("Sam notified of delivery")).toBeVisible({ timeout: 20_000 });

  // The job record and audit trail show it.
  await page.goto(jobUrl);
  await expect(page.getByText("Vehicle delivered").first()).toBeVisible();
});

test("owner can turn automatic delivery notices off", async ({ page }) => {
  await page.goto("/owner/settings/notifications");
  await page.getByRole("switch", { name: /Text and email the customer automatically/ }).uncheck({ force: true });
  await expect(page.getByText(/Drivers will see a “Send delivery notice” button/)).toBeVisible();
});
