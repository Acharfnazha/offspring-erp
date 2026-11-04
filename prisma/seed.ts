/* eslint-disable no-console */
// FICTIONAL SAMPLE DATA — for demonstration only. None of these records are real Offspring Group transactions.
import { PrismaClient, type Grade, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { receiveBatch } from "../src/lib/services/inventory";
import { confirmOrder, createOrder, dispatchOrder } from "../src/lib/services/orders";
import { createInvoice, createInvoiceFromOrder, issueInvoice, recordPayment, refreshOverdue } from "../src/lib/services/finance";
import { addStorageMovement, createStorageContract } from "../src/lib/services/storage";
import { PERMISSIONS, ROLE_PERMISSIONS } from "../src/lib/auth/permissions";
import { nextNumber } from "../src/lib/numbering";
import { addDays, isoDate, todayDate } from "../src/lib/dates";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const SAMPLE = "Fictional sample record (demo data).";

let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
const between = (a: number, b: number) => a + rand() * (b - a);

async function reset() {
  // Ledger tables have immutability triggers; disable them only for the reset.
  await prisma.$executeRawUnsafe(`ALTER TABLE "InventoryMovement" DISABLE TRIGGER inventory_movement_immutable`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" DISABLE TRIGGER audit_log_immutable`);
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "InventoryMovement" ENABLE TRIGGER inventory_movement_immutable`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" ENABLE TRIGGER audit_log_immutable`);
}

async function main() {
  console.log("Resetting database…");
  await reset();
  const today = todayDate();
  const daysAgo = (n: number) => addDays(today, -n);

  // ── Permissions catalogue
  await prisma.permission.createMany({ data: Object.entries(PERMISSIONS).map(([key, description]) => ({ key, description })) });
  await prisma.rolePermission.createMany({ data: Object.entries(ROLE_PERMISSIONS).flatMap(([role, perms]) => perms.map((p) => ({ role: role as Role, permissionKey: p }))) });

  // ── Users (password for all demo users: Offspring!2026)
  const hash = await bcrypt.hash("Offspring!2026", 12);
  const users: [string, string, Role, string][] = [
    ["admin@offspring.example", "Rami Haddad", "SUPER_ADMIN", "General Manager"],
    ["it@offspring.example", "Nour Khalil", "ADMIN", "IT Administrator"],
    ["accounts@offspring.example", "Maya Saad", "ACCOUNTANT", "Chief Accountant"],
    ["warehouse@offspring.example", "Karim Aoun", "WAREHOUSE_MANAGER", "Cold Store Manager"],
    ["sales@offspring.example", "Lara Mansour", "SALES_MANAGER", "Export Sales Manager"],
    ["logistics@offspring.example", "Fadi Nassar", "LOGISTICS_MANAGER", "Logistics Coordinator"],
    ["staff@offspring.example", "Joe Daher", "EMPLOYEE", "Warehouse Operator"],
    ["viewer@offspring.example", "Board Observer", "VIEWER", "Board Member"],
  ];
  const u: Record<string, string> = {};
  for (const [email, name, role, jobTitle] of users) {
    const user = await prisma.user.create({ data: { email, name, role, jobTitle, passwordHash: hash } });
    u[role] = user.id;
  }
  const admin = u.SUPER_ADMIN;

  // ── Settings
  const settings: Record<string, unknown> = {
    company: { name: "Offspring Group S.A.R.L.", address: "Bekaa Valley, Lebanon", phone: "+961 0 000 000", email: "info@offspring.example", website: "offspring.example", taxId: "—", bank: "Bank details available on request" },
    storageBilling: { ratePerKgMonth: "0.05", minimumPeriods: 1 },
    exchangeRates: { USD: 1, AED: 3.6725, SAR: 3.75, QAR: 3.64, KWD: 0.307, IQD: 1310, MXN: 17.5, EUR: 0.92 },
    packagingDefaults: { cartonWeightKg: 5, items: [{ name: "Grape preservation sheet", costPerCarton: 0.2 }, { name: "Carton packaging materials", costPerCarton: 0.2 }, { name: "Protective absorbent pad", costPerCarton: 0.1 }], laborPerCarton: 0.15 },
    inventory: { allocationStrategy: "FEFO", expiryAlertDays: 7 },
    ai: { mode: "demo" },
  };
  for (const [key, value] of Object.entries(settings)) await prisma.setting.create({ data: { key, value: value as object } });

  // ── Products & varieties
  const catalog: [string, "APPLE" | "GRAPE" | "PEACH" | "NECTARINE", [string, number, number][]][] = [
    ["Apples", "APPLE", [["Red Delicious", 180, 0.55], ["Golden Delicious", 160, 0.5], ["Gala", 150, 0.6], ["Jirdi (Lebanese mountain)", 170, 0.45]]],
    ["Grapes", "GRAPE", [["Red Globe", 60, 1.5], ["Crimson Seedless", 55, 1.725], ["Sugraone", 45, 1.65], ["Scarlet Seedless", 55, 1.75], ["Chili Black", 50, 1.6]]],
    ["Peaches", "PEACH", [["Yellow Peach", 25, 0.9]]],
    ["Nectarines", "NECTARINE", [["Red Nectarine", 25, 0.95]]],
  ];
  const v: Record<string, string> = {};
  for (const [pname, cat, vars] of catalog) {
    const p = await prisma.product.create({ data: { name: pname, category: cat } });
    for (const [vn, shelf, ref] of vars) {
      const pv = await prisma.productVariety.create({ data: { productId: p.id, name: vn, shelfLifeDays: shelf, referenceCostKg: ref } });
      v[vn] = pv.id;
    }
  }

  // ── Warehouses & cold rooms
  const wh = await prisma.warehouse.create({ data: { code: "WH-BKA", name: "Bekaa Cold Store", location: "Zahle, Bekaa (sample)" } });
  const wh2 = await prisma.warehouse.create({ data: { code: "WH-BEY", name: "Beirut Port Hub", location: "Beirut (sample)" } });
  const roomsDef: [string, string, string, number, number, number][] = [
    ["CR-01", "Cold Room 1 — Apples", wh.id, 400000, 0.5, 92],
    ["CR-02", "Cold Room 2 — Apples", wh.id, 350000, 0.5, 92],
    ["CR-03", "Cold Room 3 — Grapes", wh.id, 250000, -0.5, 93],
    ["CR-04", "Cold Room 4 — Stone fruit", wh.id, 150000, 0.0, 90],
    ["CR-05", "Customer Storage A", wh.id, 300000, 1.0, 90],
    ["PH-01", "Port Pre-cooling", wh2.id, 120000, 1.0, 90],
  ];
  const r: Record<string, string> = {};
  for (const [code, name, w, cap, t, h] of roomsDef) {
    const room = await prisma.coldRoom.create({ data: { code, name, warehouseId: w, capacityKg: cap, targetTempC: t, targetHumidity: h, status: code === "PH-01" ? "MAINTENANCE" : "OPERATIONAL", maintenanceNotes: code === "PH-01" ? "Compressor service scheduled (sample)" : null } });
    r[code] = room.id;
    // Manual readings, last 10 days
    let last = { t, h };
    for (let d = 10; d >= 0; d--) {
      const temp = code === "CR-04" && d === 0 ? t + 3.2 : t + between(-0.6, 0.6);
      const hum = h + between(-2, 2);
      last = { t: temp, h: hum };
      await prisma.coldRoomReading.create({
        data: { coldRoomId: room.id, temperatureC: temp.toFixed(2), humidity: hum.toFixed(2), recordedAt: new Date(daysAgo(d).getTime() + 8 * 3600000), recordedById: u.WAREHOUSE_MANAGER, outOfRange: Math.abs(temp - t) > 1.5 },
      });
    }
    await prisma.coldRoom.update({ where: { id: room.id }, data: { currentTempC: last.t.toFixed(2), currentHumidity: last.h.toFixed(2), lastReadingAt: new Date(today.getTime() + 8 * 3600000) } });
  }

  // ── Suppliers
  const supplierNames = ["Bekaa Orchards Cooperative", "Mount Lebanon Apple Growers", "Zahle Vineyards Co.", "Akkar Fresh Farms", "South Valley Stone Fruit"];
  const s: string[] = [];
  for (const [i, name] of supplierNames.entries()) {
    const sup = await prisma.supplier.create({
      data: {
        code: `SUP-${String(i + 1).padStart(3, "0")}`, name, contactPerson: pick(["Elie", "Georges", "Hassan", "Samir", "Rita"]) + " " + pick(["Khoury", "Haddad", "Fares", "Najjar"]),
        email: `contact${i + 1}@supplier.example`, phone: `+961 70 ${100000 + i * 1111}`, country: "Lebanon", city: pick(["Zahle", "Baalbek", "Bcharre", "Halba", "Marjayoun"]),
        productsSupplied: i === 2 ? "Red Globe, Crimson Seedless, Sugraone, Scarlet Seedless" : i === 4 ? "Peaches, nectarines" : "Red Delicious, Golden Delicious, Gala, Jirdi",
        qualityRating: 3 + (i % 3), qualityNotes: SAMPLE, paymentTermsDays: 30,
      },
    });
    s.push(sup.id);
  }

  // ── Customers (fictional companies)
  const custDef: [string, string, string, string, "IMPORTER" | "WHOLESALER" | "SUPERMARKET" | "DISTRIBUTOR" | "EXPORT_PARTNER" | "COLD_STORAGE_CUSTOMER", string][] = [
    ["Gulf Fresh Trading LLC", "United Arab Emirates", "Dubai", "AED", "IMPORTER", "Jebel Ali"],
    ["Al Noor Hypermarkets", "Saudi Arabia", "Riyadh", "SAR", "SUPERMARKET", "Jeddah"],
    ["Doha Fruit Distribution", "Qatar", "Doha", "USD", "DISTRIBUTOR", "Hamad"],
    ["Kuwait Green Market Co.", "Kuwait", "Kuwait City", "USD", "WHOLESALER", "Shuwaikh"],
    ["Basra Produce Importers", "Iraq", "Basra", "USD", "IMPORTER", "Umm Qasr"],
    ["Atlantic Orchard Imports Inc.", "United States", "Miami", "USD", "IMPORTER", "Miami"],
    ["Frutas del Norte S.A. de C.V.", "Mexico", "Monterrey", "USD", "DISTRIBUTOR", "Veracruz"],
    ["Maghreb Fresh SARL", "Morocco", "Casablanca", "USD", "EXPORT_PARTNER", "Casablanca"],
    ["Bekaa Growers Union (storage)", "Lebanon", "Zahle", "USD", "COLD_STORAGE_CUSTOMER", "—"],
    ["Cedar Valley Farms (storage)", "Lebanon", "Baalbek", "USD", "COLD_STORAGE_CUSTOMER", "—"],
  ];
  const stages = ["PAID", "SHIPPED", "NEGOTIATION", "QUOTATION_SENT", "DELIVERED", "ORDER_CONFIRMED", "CONTACTED", "NEW_LEAD", "ORDER_CONFIRMED", "CLOSED"] as const;
  const c: { id: string; port: string; country: string }[] = [];
  for (const [i, [name, country, city, cur, type, port]] of custDef.entries()) {
    const cust = await prisma.customer.create({
      data: {
        code: `CUS-${String(i + 1).padStart(3, "0")}`, companyName: name, country, city, currency: cur === "AED" || cur === "SAR" ? "USD" : cur, type,
        contactPerson: pick(["Ahmed", "Omar", "Sarah", "John", "Carlos", "Fatima", "Youssef"]) + " " + pick(["Al Mansouri", "Smith", "Garcia", "Benali", "Al Thani", "Hussein"]),
        email: `buyer${i + 1}@customer.example`, whatsapp: `+000 ${5000000 + i * 1234}`, phone: `+000 ${4000000 + i * 4321}`, website: `customer${i + 1}.example`,
        paymentTermsDays: [30, 45, 30, 60, 30, 45, 60, 30, 15, 15][i], paymentTerms: i % 2 ? "30% advance, 70% against BL copy" : "Net terms by bank transfer",
        creditLimit: [150000, 200000, 80000, 60000, 50000, 250000, 120000, 70000, 20000, 15000][i], pipelineStage: stages[i],
        nextFollowUpAt: i === 2 || i === 3 ? addDays(today, i - 3) : null, notes: SAMPLE,
      },
    });
    c.push({ id: cust.id, port, country });
  }

  // ── Purchase order + goods receipt (validated receipt creates inventory)
  const batches: { id: string; variety: string }[] = [];
  const receipts: [string, Grade, number, number, number, string, number][] = [
    // variety, grade, kg, cost/kg, daysAgo, room, supplierIdx
    ["Red Delicious", "EXTRA", 60000, 0.55, 150, "CR-01", 0],
    ["Golden Delicious", "CLASS_I", 45000, 0.5, 140, "CR-01", 1],
    ["Gala", "EXTRA", 30000, 0.62, 120, "CR-02", 0],
    ["Jirdi (Lebanese mountain)", "CLASS_I", 40000, 0.45, 100, "CR-02", 1],
    ["Red Globe", "EXTRA", 36000, 1.5, 75, "CR-03", 2],
    ["Crimson Seedless", "CLASS_I", 24000, 1.72, 60, "CR-03", 2],
    ["Scarlet Seedless", "EXTRA", 15000, 1.75, 40, "CR-03", 2],
    ["Sugraone", "CLASS_I", 12000, 1.65, 30, "CR-03", 2],
    ["Red Delicious", "CLASS_I", 50000, 0.52, 45, "CR-02", 3],
    ["Yellow Peach", "CLASS_I", 8000, 0.9, 12, "CR-04", 4],
    ["Red Nectarine", "CLASS_II", 6000, 0.95, 10, "CR-04", 4],
    ["Red Globe", "CLASS_I", 20000, 1.48, 8, "CR-03", 2],
  ];
  for (const [vn, grade, kg, cost, ago, room, si] of receipts) {
    await prisma.$transaction(async (tx) => {
      const variety = await tx.productVariety.findUniqueOrThrow({ where: { id: v[vn] } });
      const poNo = await nextNumber(tx, "PO");
      const po = await tx.purchaseOrder.create({
        data: { poNo, supplierId: s[si], status: "RECEIVED", orderDate: daysAgo(ago + 5), expectedDate: daysAgo(ago), notes: SAMPLE, items: { create: { varietyId: v[vn], grade, quantityKg: kg, unitCostKg: cost, receivedKg: kg } } },
      });
      const grn = await tx.goodsReceipt.create({ data: { receiptNo: await nextNumber(tx, "GRN"), poId: po.id, supplierId: s[si], receivedAt: daysAgo(ago), createdById: u.WAREHOUSE_MANAGER } });
      const carton = vn.includes("Globe") || vn.includes("Seedless") || vn.includes("Sugra") ? 5 : 18;
      const b = await receiveBatch(
        tx,
        {
          varietyId: v[vn], grade, origin: "Lebanon", supplierId: s[si], goodsReceiptId: grn.id, harvestDate: daysAgo(ago + 3), arrivalDate: daysAgo(ago),
          expiryDate: addDays(daysAgo(ago), variety.shelfLifeDays), quantityKg: kg, cartons: Math.ceil(kg / carton), packagingType: carton === 5 ? "5 kg carton, preservation sheet" : "18 kg telescopic carton",
          costPerKg: cost, coldRoomId: r[room], reference: grn.receiptNo,
        },
        u.WAREHOUSE_MANAGER,
      );
      batches.push({ id: b.id, variety: vn });
      // Purchase invoice from supplier
      const inv = await createInvoice(tx, { type: "PURCHASE", supplierId: s[si], purchaseOrderId: po.id, issueDate: daysAgo(ago), dueDate: addDays(daysAgo(ago), 30), currency: "USD", items: [{ description: `${vn} ${grade} — ${po.poNo}`, quantity: kg, unitPrice: cost }], issue: true }, u.ACCOUNTANT);
      if (ago > 35) {
        await recordPayment(tx, { direction: "OUTGOING", supplierId: s[si], method: "BANK_TRANSFER", amount: inv.total.toString(), currency: "USD", paidAt: addDays(daysAgo(ago), 25), reference: `TRF-S-${inv.invoiceNo}`, idempotencyKey: randomUUID(), allocations: [{ invoiceId: inv.id, amount: inv.total.toString() }] }, u.ACCOUNTANT);
      }
    });
  }

  // ── Sales: orders over the past months, dispatched & invoiced, with payments
  const sales: [number, string, Grade, number, number, number, "paid" | "partial" | "open" | "overdue" | "confirmed"][] = [
    // customerIdx, variety, grade, kg, price, daysAgo, payment state
    [0, "Red Delicious", "EXTRA", 20000, 1.1, 130, "paid"],
    [1, "Golden Delicious", "CLASS_I", 18000, 0.98, 115, "paid"],
    [5, "Gala", "EXTRA", 15000, 1.25, 95, "paid"],
    [4, "Jirdi (Lebanese mountain)", "CLASS_I", 22000, 0.85, 80, "paid"],
    [0, "Red Globe", "EXTRA", 16000, 2.45, 60, "partial"],
    [2, "Crimson Seedless", "CLASS_I", 10000, 2.7, 45, "overdue"],
    [3, "Red Delicious", "EXTRA", 12000, 1.12, 38, "paid"],
    [6, "Golden Delicious", "CLASS_I", 14000, 1.05, 30, "partial"],
    [1, "Scarlet Seedless", "EXTRA", 6000, 2.85, 20, "open"],
    [7, "Red Delicious", "CLASS_I", 18000, 0.95, 12, "open"],
    [0, "Red Globe", "CLASS_I", 8000, 2.3, 4, "confirmed"],
  ];
  const shippingLines = ["Mediterranean Line (sample)", "Levant Express Shipping (sample)", "Oceanic Reefer Co. (sample)"];
  for (const [ci, vn, grade, kg, price, ago, state] of sales) {
    await prisma.$transaction(async (tx) => {
      const order = await createOrder(tx, { customerId: c[ci].id, orderDate: daysAgo(ago), currency: "USD", incoterm: pick(["FOB", "CFR", "CIF"] as const), paymentTerms: "Bank transfer", expectedShipmentDate: daysAgo(ago - 7), notes: SAMPLE, items: [{ varietyId: v[vn], grade, quantityKg: kg, unitPrice: price, packaging: vn.includes("Globe") || vn.includes("Seedless") ? "5 kg carton" : "18 kg carton" }] }, u.SALES_MANAGER);
      await tx.salesOrder.update({ where: { id: order.id }, data: { createdAt: daysAgo(ago) } });
      await confirmOrder(tx, order.id, u.SALES_MANAGER, {});
      if (state === "confirmed") return;
      const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
      const shipment = await tx.shipment.create({
        data: {
          shipmentNo: await nextNumber(tx, "SHP"), customerId: c[ci].id, containerNo: `OFSU${String(Math.floor(between(1000000, 9999999)))}`, containerType: "40' Reefer HC",
          shippingLine: pick(shippingLines), freightForwarder: "Cedar Forwarding (sample)", origin: "Lebanon", destination: c[ci].country, portOfLoading: "Beirut", portOfDischarge: c[ci].port,
          etd: daysAgo(ago - 5), atd: daysAgo(ago - 6), eta: daysAgo(ago - 18), ata: ago > 25 ? daysAgo(ago - 19) : null,
          grossWeightKg: kg * 1.08, netWeightKg: kg, cartons: Math.ceil(kg / 5), freightCost: Math.round(between(2600, 4800)), insuranceCost: Math.round(between(120, 300)), documentationCost: 180, customsCost: Math.round(between(150, 400)),
          status: ago > 40 ? "COMPLETED" : ago > 25 ? "DELIVERED" : "IN_TRANSIT", notes: SAMPLE,
          orders: { create: { orderId: order.id } },
          events: { create: [{ status: "PLANNING", occurredAt: daysAgo(ago) }, { status: "PACKING", occurredAt: daysAgo(ago - 2) }, { status: "IN_TRANSIT", occurredAt: daysAgo(ago - 6), location: "Beirut" }, ...(ago > 25 ? [{ status: "DELIVERED" as const, occurredAt: daysAgo(ago - 20), location: c[ci].port }] : [])] },
        },
      });
      await dispatchOrder(tx, order.id, items.map((i) => ({ orderItemId: i.id, quantityKg: i.quantityKg.toString() })), u.WAREHOUSE_MANAGER, shipment.id);
      const inv = await createInvoiceFromOrder(tx, order.id, u.ACCOUNTANT);
      await tx.invoice.update({ where: { id: inv.id }, data: { issueDate: daysAgo(ago - 6), dueDate: addDays(daysAgo(ago - 6), state === "overdue" ? 20 : 45), shipmentId: shipment.id } });
      await issueInvoice(tx, inv.id, u.ACCOUNTANT);
      const total = Number(inv.total);
      const pay = state === "paid" ? total : state === "partial" ? Math.round(total * 0.4) : 0;
      if (pay > 0)
        await recordPayment(tx, { direction: "INCOMING", customerId: c[ci].id, method: "BANK_TRANSFER", amount: pay, currency: "USD", paidAt: daysAgo(Math.max(ago - 25, 1)), reference: `SWIFT-${inv.invoiceNo}`, idempotencyKey: randomUUID(), allocations: [{ invoiceId: inv.id, amount: pay }] }, u.ACCOUNTANT);
    });
  }
  // An advance payment (unallocated) from a customer
  await prisma.$transaction((tx) => recordPayment(tx, { direction: "INCOMING", customerId: c[0].id, method: "BANK_TRANSFER", amount: 5000, currency: "USD", paidAt: daysAgo(3), reference: "SWIFT-ADV-001", notes: "Advance for next Red Globe order (sample)", idempotencyKey: randomUUID(), allocations: [] }, u.ACCOUNTANT));

  // ── Quotations
  for (const [ci, vn, kg, price, status] of [[2, "Red Globe", 12000, 2.5, "SENT"], [3, "Gala", 20000, 1.2, "DRAFT"], [5, "Crimson Seedless", 18000, 2.75, "SENT"]] as const) {
    await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.create({
        data: {
          quoteNo: await nextNumber(tx, "QT"), customerId: c[ci].id, status, issueDate: daysAgo(5), validUntil: addDays(today, 10), incoterm: "CFR", paymentTerms: "30% advance, balance against copy of BL",
          portOfLoading: "Beirut", portOfDischarge: c[ci].port, shipmentDetails: "1 × 40' reefer, shipment within 2 weeks of order confirmation", notes: SAMPLE,
          subtotal: (kg * price).toFixed(2), total: (kg * price).toFixed(2), createdById: u.SALES_MANAGER,
          items: { create: { varietyId: v[vn], description: `${vn}`, grade: "EXTRA", origin: "Lebanon", packaging: vn === "Gala" ? "18 kg carton" : "5 kg carton", quantityKg: kg, unitPrice: price, lineTotal: (kg * price).toFixed(2) } },
        },
      });
      await tx.quotationRevision.create({ data: { quotationId: q.id, revision: 1, snapshot: { note: "Initial version" }, createdById: u.SALES_MANAGER } });
    });
  }

  // ── Cold-storage contracts for third parties
  await prisma.$transaction(async (tx) => {
    const k1 = await createStorageContract(tx, { customerId: c[8].id, varietyId: v["Red Delicious"], productDescription: "Apples (customer-owned)", batchReference: "BGU-24-17", coldRoomId: r["CR-05"], ratePerKgMonth: "0.05", entryDate: daysAgo(100), quantityKg: 80000, notes: SAMPLE }, admin);
    await addStorageMovement(tx, k1.id, "OUT", 30000, daysAgo(55), admin, "Partial release");
    await addStorageMovement(tx, k1.id, "OUT", 20000, daysAgo(20), admin, "Partial release");
    const k2 = await createStorageContract(tx, { customerId: c[9].id, varietyId: v["Golden Delicious"], productDescription: "Golden apples (customer-owned)", coldRoomId: r["CR-05"], ratePerKgMonth: "0.05", entryDate: daysAgo(40), quantityKg: 45000, notes: SAMPLE }, admin);
    void k2;
  });

  // ── Expenses
  const expCats = [
    ["ELECTRICITY", "Cold store electricity", 3800, 5200],
    ["SALARIES", "Monthly payroll", 14000, 16000],
    ["FUEL", "Generator diesel", 1500, 2600],
    ["MAINTENANCE", "Refrigeration maintenance", 400, 1400],
    ["PACKAGING", "Cartons & liners", 1800, 3600],
    ["TRANSPORTATION", "Inland trucking to port", 900, 1800],
    ["ADMINISTRATIVE", "Office & admin", 500, 900],
  ] as const;
  for (let m = 5; m >= 0; m--) {
    for (const [cat, desc, lo, hi] of expCats) {
      const d = addDays(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - m, 1)), Math.floor(between(0, 25)));
      if (d > today) continue;
      await prisma.expense.create({
        data: { expenseNo: await nextNumber(prisma, "EXP"), category: cat, description: `${desc} (sample)`, vendor: "Sample vendor", amount: between(lo, hi).toFixed(2), date: d, status: m === 0 && cat === "MAINTENANCE" ? "PENDING" : "APPROVED", approvedById: m === 0 && cat === "MAINTENANCE" ? null : u.ACCOUNTANT, approvedAt: new Date(), createdById: u.ACCOUNTANT },
      });
    }
  }

  // Historical import: align ledger timestamps with the business dates of the sample documents.
  await prisma.$executeRawUnsafe(`ALTER TABLE "InventoryMovement" DISABLE TRIGGER inventory_movement_immutable`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" DISABLE TRIGGER audit_log_immutable`);
  await prisma.$executeRawUnsafe(`UPDATE "InventoryMovement" m SET "createdAt" = (o."expectedShipmentDate" + interval '9 hours') FROM "SalesOrder" o WHERE m.reference = o."orderNo" AND m.type IN ('DISPATCH','RESERVE','RELEASE') AND o."expectedShipmentDate" IS NOT NULL`);
  await prisma.$executeRawUnsafe(`UPDATE "InventoryMovement" m SET "createdAt" = (b."arrivalDate" + interval '8 hours') FROM "InventoryBatch" b WHERE m."batchId" = b.id AND m.type = 'RECEIPT'`);
  await prisma.$executeRawUnsafe(`UPDATE "InventoryMovement" m SET "createdAt" = LEAST(m."createdAt", (o."orderDate" + interval '10 hours')) FROM "SalesOrder" o WHERE m.reference = o."orderNo" AND m.type = 'RESERVE'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "InventoryMovement" ENABLE TRIGGER inventory_movement_immutable`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" ENABLE TRIGGER audit_log_immutable`);
  await prisma.$executeRawUnsafe(`UPDATE "SalesOrder" SET "confirmedAt" = "orderDate" + interval '10 hours' WHERE "confirmedAt" IS NOT NULL`);
  await prisma.$executeRawUnsafe(`UPDATE "Payment" SET "createdAt" = "paidAt" + interval '12 hours'`);

  await refreshOverdue(prisma);
  console.log(`Seed complete (${isoDate(today)}). Sign in with admin@offspring.example / Offspring!2026`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
