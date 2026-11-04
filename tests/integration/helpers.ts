import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/dates";

export async function resetDb() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "InventoryMovement" DISABLE TRIGGER inventory_movement_immutable`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" DISABLE TRIGGER audit_log_immutable`);
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "InventoryMovement" ENABLE TRIGGER inventory_movement_immutable`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" ENABLE TRIGGER audit_log_immutable`);
}

export async function fixtures() {
  const user = await prisma.user.create({ data: { email: "t@test.local", name: "Tester", role: "SUPER_ADMIN", passwordHash: "x" } });
  const apples = await prisma.product.create({ data: { name: "Apples", category: "APPLE" } });
  const grapes = await prisma.product.create({ data: { name: "Grapes", category: "GRAPE" } });
  const redDel = await prisma.productVariety.create({ data: { productId: apples.id, name: "Red Delicious", shelfLifeDays: 180 } });
  const redGlobe = await prisma.productVariety.create({ data: { productId: grapes.id, name: "Red Globe", shelfLifeDays: 60 } });
  const wh = await prisma.warehouse.create({ data: { code: "WH", name: "Test WH" } });
  const room = await prisma.coldRoom.create({ data: { code: "R1", name: "Room 1", warehouseId: wh.id, capacityKg: 100000, targetTempC: 0.5, targetHumidity: 90 } });
  const room2 = await prisma.coldRoom.create({ data: { code: "R2", name: "Room 2", warehouseId: wh.id, capacityKg: 30000, targetTempC: 0.5, targetHumidity: 90 } });
  const customer = await prisma.customer.create({ data: { code: "C1", companyName: "Dubai Fresh Test LLC", country: "United Arab Emirates", city: "Dubai", paymentTermsDays: 30 } });
  const customer2 = await prisma.customer.create({ data: { code: "C2", companyName: "Other Buyer", country: "Qatar" } });
  const supplier = await prisma.supplier.create({ data: { code: "S1", name: "Test Orchard" } });
  return { user, redDel, redGlobe, room, room2, customer, customer2, supplier, d: parseDateOnly };
}
