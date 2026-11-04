-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'SALES_MANAGER', 'LOGISTICS_MANAGER', 'EMPLOYEE', 'VIEWER');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('IMPORTER', 'WHOLESALER', 'SUPERMARKET', 'DISTRIBUTOR', 'EXPORT_PARTNER', 'COLD_STORAGE_CUSTOMER');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('NEW_LEAD', 'CONTACTED', 'NEGOTIATION', 'QUOTATION_SENT', 'ORDER_CONFIRMED', 'SHIPMENT_PREPARATION', 'SHIPPED', 'DELIVERED', 'PAID', 'CLOSED');

-- CreateEnum
CREATE TYPE "FruitCategory" AS ENUM ('APPLE', 'GRAPE', 'PEACH', 'NECTARINE', 'OTHER');

-- CreateEnum
CREATE TYPE "ColdRoomStatus" AS ENUM ('OPERATIONAL', 'MAINTENANCE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('EXTRA', 'CLASS_I', 'CLASS_II', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'DEPLETED', 'QUARANTINE', 'SPOILED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('RECEIPT', 'TRANSFER_OUT', 'TRANSFER_IN', 'RESERVE', 'RELEASE', 'SPOILAGE', 'DISPATCH', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'FULFILLED', 'RELEASED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StorageMovementType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Incoterm" AS ENUM ('EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DDP');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PLANNING', 'PACKING', 'READY_FOR_DISPATCH', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('SALES', 'PURCHASE', 'COLD_STORAGE', 'PRO_FORMA', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FRUIT_PURCHASES', 'PACKAGING', 'TRANSPORTATION', 'FUEL', 'ELECTRICITY', 'REFRIGERATION', 'MAINTENANCE', 'LABOR', 'SALARIES', 'CUSTOMS', 'FREIGHT', 'INSURANCE', 'ADMINISTRATIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "DocumentAccess" AS ENUM ('ALL_STAFF', 'FINANCE', 'MANAGEMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "jobTitle" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "lastLoginAt" TIMESTAMP(3),
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "role" "Role" NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "grantedById" TEXT,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("role","permissionKey")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "audienceRole" "Role",
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "contactPerson" TEXT,
    "email" TEXT,
    "whatsapp" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "paymentTerms" TEXT,
    "type" "CustomerType" NOT NULL DEFAULT 'IMPORTER',
    "creditLimit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pipelineStage" "PipelineStage" NOT NULL DEFAULT 'NEW_LEAD',
    "nextFollowUpAt" TIMESTAMP(3),
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Lebanon',
    "city" TEXT,
    "address" TEXT,
    "productsSupplied" TEXT,
    "pricingNotes" TEXT,
    "qualityNotes" TEXT,
    "qualityRating" INTEGER,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "FruitCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariety" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shelfLifeDays" INTEGER NOT NULL DEFAULT 90,
    "referenceCostKg" DECIMAL(18,4),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductVariety_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdRoom" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "capacityKg" DECIMAL(14,3) NOT NULL,
    "targetTempC" DECIMAL(5,2) NOT NULL,
    "targetHumidity" DECIMAL(5,2) NOT NULL,
    "tempToleranceC" DECIMAL(5,2) NOT NULL DEFAULT 1.5,
    "currentTempC" DECIMAL(5,2),
    "currentHumidity" DECIMAL(5,2),
    "lastReadingAt" TIMESTAMP(3),
    "status" "ColdRoomStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "maintenanceNotes" TEXT,
    "sensorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColdRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdRoomReading" (
    "id" TEXT NOT NULL,
    "coldRoomId" TEXT NOT NULL,
    "temperatureC" DECIMAL(5,2) NOT NULL,
    "humidity" DECIMAL(5,2),
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "outOfRange" BOOLEAN NOT NULL DEFAULT false,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ColdRoomReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBatch" (
    "id" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "varietyId" TEXT NOT NULL,
    "grade" "Grade" NOT NULL DEFAULT 'CLASS_I',
    "customGrade" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'Lebanon',
    "supplierId" TEXT,
    "goodsReceiptId" TEXT,
    "parentBatchId" TEXT,
    "harvestDate" DATE,
    "arrivalDate" DATE NOT NULL,
    "expiryDate" DATE,
    "receivedKg" DECIMAL(14,3) NOT NULL,
    "onHandKg" DECIMAL(14,3) NOT NULL,
    "reservedKg" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "cartons" INTEGER NOT NULL DEFAULT 0,
    "packagingType" TEXT,
    "costPerKg" DECIMAL(18,4) NOT NULL,
    "coldRoomId" TEXT,
    "status" "BatchStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantityKg" DECIMAL(14,3) NOT NULL,
    "onHandAfterKg" DECIMAL(14,3) NOT NULL,
    "reservedAfterKg" DECIMAL(14,3) NOT NULL,
    "cartons" INTEGER,
    "reference" TEXT,
    "notes" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "quantityKg" DECIMAL(14,3) NOT NULL,
    "fulfilledKg" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageContract" (
    "id" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "varietyId" TEXT,
    "productDescription" TEXT NOT NULL,
    "batchReference" TEXT,
    "coldRoomId" TEXT NOT NULL,
    "ratePerKgMonth" DECIMAL(18,4) NOT NULL DEFAULT 0.05,
    "minimumPeriods" INTEGER NOT NULL DEFAULT 1,
    "entryDate" DATE NOT NULL,
    "exitDate" DATE,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageMovement" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "type" "StorageMovementType" NOT NULL,
    "quantityKg" DECIMAL(14,3) NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageAdjustment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNo" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" DATE NOT NULL,
    "expectedDate" DATE,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "varietyId" TEXT NOT NULL,
    "grade" "Grade" NOT NULL DEFAULT 'CLASS_I',
    "quantityKg" DECIMAL(14,3) NOT NULL,
    "unitCostKg" DECIMAL(18,4) NOT NULL,
    "receivedKg" DECIMAL(14,3) NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "poId" TEXT,
    "supplierId" TEXT NOT NULL,
    "receivedAt" DATE NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "quoteNo" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "customerId" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" DATE NOT NULL,
    "validUntil" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "incoterm" "Incoterm" NOT NULL DEFAULT 'FOB',
    "paymentTerms" TEXT,
    "deliveryTerms" TEXT,
    "portOfLoading" TEXT,
    "portOfDischarge" TEXT,
    "shipmentDetails" TEXT,
    "notes" TEXT,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "varietyId" TEXT,
    "description" TEXT NOT NULL,
    "grade" "Grade" NOT NULL DEFAULT 'CLASS_I',
    "origin" TEXT NOT NULL DEFAULT 'Lebanon',
    "packaging" TEXT,
    "quantityKg" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationRevision" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "quotationId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "incoterm" "Incoterm" NOT NULL DEFAULT 'FOB',
    "paymentTerms" TEXT,
    "deliveryTerms" TEXT,
    "expectedShipmentDate" DATE,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "overrideReason" TEXT,
    "overrideById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "varietyId" TEXT NOT NULL,
    "grade" "Grade" NOT NULL DEFAULT 'CLASS_I',
    "description" TEXT,
    "packaging" TEXT,
    "quantityKg" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "fulfilledKg" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "cogsAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "shipmentNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "containerNo" TEXT,
    "containerType" TEXT,
    "transportMode" TEXT NOT NULL DEFAULT 'SEA',
    "shippingLine" TEXT,
    "freightForwarder" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'Lebanon',
    "destination" TEXT NOT NULL,
    "portOfLoading" TEXT,
    "portOfDischarge" TEXT,
    "etd" DATE,
    "atd" DATE,
    "eta" DATE,
    "ata" DATE,
    "grossWeightKg" DECIMAL(14,3),
    "netWeightKg" DECIMAL(14,3),
    "cartons" INTEGER,
    "freightCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "insuranceCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "documentationCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "customsCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PLANNING',
    "trackingProvider" TEXT,
    "trackingRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentOrder" (
    "shipmentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,

    CONSTRAINT "ShipmentOrder_pkey" PRIMARY KEY ("shipmentId","orderId")
);

-- CreateTable
CREATE TABLE "ShipmentItem" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantityKg" DECIMAL(14,3) NOT NULL,
    "cartons" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "note" TEXT,
    "location" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT,
    "supplierId" TEXT,
    "salesOrderId" TEXT,
    "purchaseOrderId" TEXT,
    "storageContractId" TEXT,
    "shipmentId" TEXT,
    "originalInvoiceId" TEXT,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "billingPeriodEnd" DATE,
    "incoterm" "Incoterm",
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "paymentNo" TEXT NOT NULL,
    "direction" "PaymentDirection" NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paidAt" DATE NOT NULL,
    "reference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "notes" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "expenseNo" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "vendor" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "date" DATE NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "shipmentId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitCalculation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "outputs" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfitCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "access" "DocumentAccess" NOT NULL DEFAULT 'ALL_STAFF',
    "description" TEXT,
    "customerId" TEXT,
    "supplierId" TEXT,
    "shipmentId" TEXT,
    "invoiceId" TEXT,
    "expenseId" TEXT,
    "batchId" TEXT,
    "uploadedById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE INDEX "Customer_companyName_idx" ON "Customer"("companyName");

-- CreateIndex
CREATE INDEX "Customer_country_idx" ON "Customer"("country");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariety_productId_name_key" ON "ProductVariety"("productId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ColdRoom_code_key" ON "ColdRoom"("code");

-- CreateIndex
CREATE INDEX "ColdRoomReading_coldRoomId_recordedAt_idx" ON "ColdRoomReading"("coldRoomId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBatch_batchNo_key" ON "InventoryBatch"("batchNo");

-- CreateIndex
CREATE INDEX "InventoryBatch_varietyId_idx" ON "InventoryBatch"("varietyId");

-- CreateIndex
CREATE INDEX "InventoryBatch_coldRoomId_idx" ON "InventoryBatch"("coldRoomId");

-- CreateIndex
CREATE INDEX "InventoryBatch_status_idx" ON "InventoryBatch"("status");

-- CreateIndex
CREATE INDEX "InventoryBatch_arrivalDate_idx" ON "InventoryBatch"("arrivalDate");

-- CreateIndex
CREATE INDEX "InventoryMovement_batchId_createdAt_idx" ON "InventoryMovement"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_type_createdAt_idx" ON "InventoryMovement"("type", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryReservation_batchId_status_idx" ON "InventoryReservation"("batchId", "status");

-- CreateIndex
CREATE INDEX "InventoryReservation_orderItemId_idx" ON "InventoryReservation"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StorageContract_contractNo_key" ON "StorageContract"("contractNo");

-- CreateIndex
CREATE INDEX "StorageMovement_contractId_date_idx" ON "StorageMovement"("contractId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNo_key" ON "PurchaseOrder"("poNo");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_receiptNo_key" ON "GoodsReceipt"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_quoteNo_key" ON "Quotation"("quoteNo");

-- CreateIndex
CREATE UNIQUE INDEX "QuotationRevision_quotationId_revision_key" ON "QuotationRevision"("quotationId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_orderNo_key" ON "SalesOrder"("orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_quotationId_key" ON "SalesOrder"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_shipmentNo_key" ON "Shipment"("shipmentNo");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");

-- CreateIndex
CREATE INDEX "Invoice_status_dueDate_idx" ON "Invoice"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_supplierId_idx" ON "Invoice"("supplierId");

-- CreateIndex
CREATE INDEX "Invoice_type_issueDate_idx" ON "Invoice"("type", "issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentNo_key" ON "Payment"("paymentNo");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_supplierId_idx" ON "Payment"("supplierId");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_invoiceId_key" ON "PaymentAllocation"("paymentId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_expenseNo_key" ON "Expense"("expenseNo");

-- CreateIndex
CREATE INDEX "Expense_category_date_idx" ON "Expense"("category", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_category_idx" ON "Document"("category");

-- CreateIndex
CREATE INDEX "Document_customerId_idx" ON "Document"("customerId");

-- CreateIndex
CREATE INDEX "Document_shipmentId_idx" ON "Document"("shipmentId");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionKey_fkey" FOREIGN KEY ("permissionKey") REFERENCES "Permission"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariety" ADD CONSTRAINT "ProductVariety_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdRoom" ADD CONSTRAINT "ColdRoom_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdRoomReading" ADD CONSTRAINT "ColdRoomReading_coldRoomId_fkey" FOREIGN KEY ("coldRoomId") REFERENCES "ColdRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdRoomReading" ADD CONSTRAINT "ColdRoomReading_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_varietyId_fkey" FOREIGN KEY ("varietyId") REFERENCES "ProductVariety"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_parentBatchId_fkey" FOREIGN KEY ("parentBatchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_coldRoomId_fkey" FOREIGN KEY ("coldRoomId") REFERENCES "ColdRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageContract" ADD CONSTRAINT "StorageContract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageContract" ADD CONSTRAINT "StorageContract_varietyId_fkey" FOREIGN KEY ("varietyId") REFERENCES "ProductVariety"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageContract" ADD CONSTRAINT "StorageContract_coldRoomId_fkey" FOREIGN KEY ("coldRoomId") REFERENCES "ColdRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageMovement" ADD CONSTRAINT "StorageMovement_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "StorageContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageAdjustment" ADD CONSTRAINT "StorageAdjustment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "StorageContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_varietyId_fkey" FOREIGN KEY ("varietyId") REFERENCES "ProductVariety"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_varietyId_fkey" FOREIGN KEY ("varietyId") REFERENCES "ProductVariety"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationRevision" ADD CONSTRAINT "QuotationRevision_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_varietyId_fkey" FOREIGN KEY ("varietyId") REFERENCES "ProductVariety"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentOrder" ADD CONSTRAINT "ShipmentOrder_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentOrder" ADD CONSTRAINT "ShipmentOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_storageContractId_fkey" FOREIGN KEY ("storageContractId") REFERENCES "StorageContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitCalculation" ADD CONSTRAINT "ProfitCalculation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
