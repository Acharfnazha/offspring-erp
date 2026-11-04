import { expect, test, type Page } from "@playwright/test";

const stamp = Date.now().toString().slice(-6);
const CUSTOMER = `E2E Dubai Imports ${stamp}`;

async function login(page: Page, email = "admin@offspring.example") {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "Offspring!2026");
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard");
}

async function confirmDialog(page: Page, reason?: string) {
  const dlg = page.getByRole("alertdialog");
  await expect(dlg).toBeVisible();
  if (reason) await dlg.locator("textarea, input").first().fill(reason);
  await dlg.getByRole("button").last().click();
}

test.describe.serial("export business workflow", () => {
  test("rejects bad credentials and protects routes", async ({ page }) => {
    await page.goto("/inventory");
    await expect(page).toHaveURL(/\/login/);
    await page.fill("#email", "admin@offspring.example");
    await page.fill("#password", "wrong-password");
    await page.click("button[type=submit]");
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
  });

  test("login → dashboard → full order-to-cash flow", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "Executive overview" })).toBeVisible();
    await expect(page.getByText("Total revenue")).toBeVisible();

    // 1. Create a customer in Dubai
    await page.goto("/customers/new");
    await page.fill("#companyName", CUSTOMER);
    await page.fill("#country", "United Arab Emirates");
    await page.fill("#city", "Dubai");
    await page.fill("#contactPerson", "Ahmed Test");
    await page.fill("#email", "buyer@e2e.example");
    await page.click("button:has-text('Create customer')");
    await page.waitForURL(/\/customers\/c[a-z0-9]+$/);
    await expect(page.getByRole("heading", { name: CUSTOMER })).toBeVisible();

    // 2. Receive 20,000 kg of apples into a refrigerated room
    await page.goto("/inventory/new");
    await page.selectOption("#varietyId", { label: "Apples — Red Delicious" });
    await page.selectOption("#grade", "EXTRA");
    await page.fill("#quantityKg", "20000");
    await page.fill("#cartons", "1112");
    await page.fill("#costPerKg", "0.55");
    await page.fill("#expiryDate", "2027-03-01");
    await page.selectOption("#coldRoomId", { index: 1 });
    await page.click("button:has-text('Receive batch')");
    await page.waitForURL(/\/inventory\/c[a-z0-9]+$/);
    await expect(page.getByText("20,000 kg").first()).toBeVisible();
    await expect(page.getByText("Receipt").first()).toBeVisible();

    // 3. Create an export quotation
    await page.goto("/quotations/new");
    await page.selectOption("#customerId", { label: `${CUSTOMER} (United Arab Emirates)` });
    await page.selectOption("#incoterm", "CFR");
    await page.fill("#portOfDischarge", "Jebel Ali");
    await page.selectOption("select[name='items.0.varietyId']", { label: "Apples — Red Delicious" });
    await page.selectOption("select[name='items.0.grade']", "EXTRA");
    await page.fill("input[name='items.0.quantityKg']", "20000");
    await page.fill("input[name='items.0.unitPrice']", "1.10");
    await expect(page.getByText("$22,000.00").last()).toBeVisible();
    await page.click("button:has-text('Save quotation')");
    await page.waitForURL(/\/quotations\/c[a-z0-9]+$/);
    await expect(page.getByText("Revision 1")).toBeVisible();
    const pdf = await page.request.get(page.url().replace("/quotations/", "/api/pdf/quotation/"));
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");

    // 4. Convert quotation → order, confirm (reserve), dispatch
    await page.getByRole("button", { name: "Convert to order" }).click();
    await confirmDialog(page);
    await page.waitForURL(/\/orders\/c[a-z0-9]+$/);
    await page.getByRole("button", { name: "Confirm & reserve" }).click();
    await confirmDialog(page);
    await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();
    const orderUrl = page.url();

    // 5. Create a container shipment for the order
    await page.getByRole("link", { name: "Create shipment" }).click();
    await page.waitForURL(/\/shipments\/new/);
    await page.fill("#containerNo", `MSCU${stamp}9`);
    await page.fill("#portOfDischarge", "Jebel Ali");
    await page.fill("#freightCost", "3200");
    await page.click("button:has-text('Create shipment')");
    await page.waitForURL(/\/shipments\/c[a-z0-9]+$/);
    await expect(page.getByText("Planning").first()).toBeVisible();

    // Dispatch onto the shipment
    await page.goto(orderUrl);
    await page.getByRole("button", { name: "Dispatch" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Post dispatch" }).click();
    await expect(page.getByText("Fulfilled", { exact: true }).first()).toBeVisible();

    // 6. Invoice, issue, download
    await page.getByRole("button", { name: "Create invoice" }).click();
    await confirmDialog(page);
    await page.waitForURL(/\/invoices\/c[a-z0-9]+$/);
    await page.getByRole("button", { name: "Issue" }).click();
    await confirmDialog(page);
    await expect(page.getByText("Issued", { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("invoice-balance")).toHaveText("$22,000.00");
    const invPdf = await page.request.get(page.url().replace("/invoices/", "/api/pdf/invoice/"));
    expect(invPdf.status()).toBe(200);

    // 7. Record a partial payment
    await page.getByRole("link", { name: "Record payment" }).click();
    await page.waitForURL(/\/payments\/new/);
    await page.fill("#amount", "10000");
    await page.fill("#reference", `SWIFT-E2E-${stamp}`);
    await page.locator("input[aria-label^='Allocate to']").first().fill("10000");
    await page.click("button:has-text('Record payment')");
    await page.waitForURL(/\/payments\/c[a-z0-9]+$/);
    await page.getByRole("link", { name: /^INV-/ }).first().click();
    await expect(page.getByTestId("invoice-balance")).toHaveText("$12,000.00");
    await expect(page.getByText("Partially paid").first()).toBeVisible();

    // 8. Analytics reflect the transactions; exports work
    await page.goto("/analytics");
    await expect(page.getByText("Profit by customer")).toBeVisible();
    await expect(page.getByText(CUSTOMER).first()).toBeVisible();
    const csv = await page.request.get("/api/export/invoices?format=csv");
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain("Invoice,Type");
    const xlsx = await page.request.get("/api/export/inventory?format=xlsx");
    expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
  });

  test("cold-storage charge calculator follows the started-month rule", async ({ page }) => {
    await login(page);
    await page.goto("/cold-storage");
    await page.fill("#bc-qty", "10000");
    await page.fill("#bc-entry", "2026-01-10");
    await page.fill("#bc-exit", "2026-02-11");
    await expect(page.getByTestId("storage-calc-result")).toContainText("$1,000.00");
    await page.fill("#bc-exit", "2026-01-25");
    await expect(page.getByTestId("storage-calc-result")).toContainText("$500.00");
  });

  test("assistant works offline and respects permissions", async ({ page }) => {
    await login(page, "warehouse@offspring.example");
    await page.goto("/assistant");
    await page.getByRole("button", { name: "Which customers have unpaid invoices?" }).click();
    await expect(page.getByTestId("assistant-message").last()).toContainText("do not have permission");
    await page.fill("input[aria-label='Question']", "How many kilograms of Red Globe grapes are available?");
    await page.getByRole("button", { name: "Ask" }).click();
    await expect(page.getByTestId("assistant-message").last()).toContainText("Red Globe");
    // Finance pages are blocked server-side for this role
    await page.goto("/invoices");
    await expect(page).toHaveURL(/forbidden/);
    const res = await page.request.get("/api/export/invoices?format=csv");
    expect(res.status()).toBe(403);
  });
});
