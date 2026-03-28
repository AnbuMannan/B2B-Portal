-- B2B Marketplace - Initial Schema (Raw DDL for review)
-- PostgreSQL DDL aligned with apps/api/src/database/schema.prisma
-- Contains enums, tables, FKs and key indexes (incl. FTS where applicable)

-- Enums
CREATE TYPE "Role" AS ENUM ('SELLER', 'BUYER', 'ADMIN');
CREATE TYPE "CompanyType" AS ENUM ('PROPRIETORSHIP', 'PRIVATE_LIMITED', 'LLP');
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "AvailabilityStatus" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK');
CREATE TYPE "AdminApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ContactChannel" AS ENUM ('WHATSAPP', 'TELEGRAM', 'EMAIL');
CREATE TYPE "RepeatOption" AS ENUM ('NONE', 'WEEKLY', 'MONTHLY');
CREATE TYPE "LeadCreditTxnType" AS ENUM ('PURCHASE', 'SPEND', 'REFUND');
CREATE TYPE "OrderStatus" AS ENUM ('QUOTED', 'ACCEPTED', 'REJECTED', 'FULFILLED', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
CREATE TYPE "AdminEntityType" AS ENUM ('SELLER_KYC', 'PRODUCT_LISTING', 'BUYER_FRAUD');
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- Users (PII)
CREATE TABLE "User" (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  "phoneNumber" TEXT UNIQUE,
  "passwordHash" TEXT NOT NULL,
  role "Role" NOT NULL DEFAULT 'BUYER',
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
CREATE INDEX "User_role_isActive_idx" ON "User"(role, "isActive");

-- Sellers
CREATE TABLE "Seller" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
  "companyName" TEXT NOT NULL,
  "companyType" "CompanyType" NOT NULL,
  "iecCode" TEXT,
  "gstNumber" TEXT,
  "panNumber" TEXT,
  "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
  "approvalDate" TIMESTAMPTZ,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
CREATE INDEX "Seller_gst_pan_idx" ON "Seller"("gstNumber", "panNumber");
CREATE INDEX "Seller_verified_kyc_idx" ON "Seller"("isVerified", "kycStatus");

-- Buyers
CREATE TABLE "Buyer" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
  "businessType" TEXT NOT NULL,
  "gstinNumber" TEXT,
  "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);

-- Categories (self-referencing)
CREATE TABLE "Category" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  "parentId" TEXT REFERENCES "Category"(id) ON DELETE SET NULL,
  "industryType" TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products
CREATE TABLE "Product" (
  id TEXT PRIMARY KEY,
  "sellerId" TEXT NOT NULL REFERENCES "Seller"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  "hsnCode" TEXT,
  unit TEXT,
  "multiTierPricing" JSONB NOT NULL,
  images JSONB,
  certifications JSONB,
  "countryOfOrigin" TEXT,
  "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'IN_STOCK',
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "adminApprovalStatus" "AdminApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "approvedBy" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "approvalDate" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
CREATE INDEX "Product_seller_active_idx" ON "Product"("sellerId", "isActive");
CREATE INDEX "Product_approval_created_idx" ON "Product"("adminApprovalStatus", "createdAt" DESC);
-- Full-text search index for product name/description
CREATE INDEX "Product_fts_idx" ON "Product" USING GIN (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'')));

-- ProductCategories (junction)
CREATE TABLE "ProductCategory" (
  "productId" TEXT NOT NULL REFERENCES "Product"(id) ON DELETE CASCADE,
  "categoryId" TEXT NOT NULL REFERENCES "Category"(id) ON DELETE CASCADE,
  PRIMARY KEY ("productId", "categoryId")
);

-- BuyLeads
CREATE TABLE "BuyLead" (
  id TEXT PRIMARY KEY,
  "buyerId" TEXT NOT NULL REFERENCES "Buyer"(id) ON DELETE CASCADE,
  "productName" TEXT NOT NULL,
  quantity NUMERIC(18,4),
  unit TEXT,
  "quantityRequired" INT,
  "targetPriceMin" NUMERIC(18,2),
  "targetPriceMax" NUMERIC(18,2),
  "expectedCountry" TEXT,
  "contactChannel" "ContactChannel" NOT NULL,
  "isOpen" BOOLEAN NOT NULL DEFAULT TRUE,
  "expiryDate" TIMESTAMPTZ,
  "repeatOption" "RepeatOption" NOT NULL DEFAULT 'NONE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ,
  "deletedAt" TIMESTAMPTZ
);
CREATE INDEX "BuyLead_buyer_idx" ON "BuyLead"("buyerId");
CREATE INDEX "BuyLead_expiry_idx" ON "BuyLead"("expiryDate");
CREATE INDEX "BuyLead_created_desc_idx" ON "BuyLead"("createdAt" DESC);
-- FTS for productName
CREATE INDEX "BuyLead_product_fts_idx" ON "BuyLead" USING GIN (to_tsvector('simple', coalesce("productName",'')));

-- LeadCreditWallet
CREATE TABLE "LeadCreditWallet" (
  id TEXT PRIMARY KEY,
  "sellerId" TEXT NOT NULL UNIQUE REFERENCES "Seller"(id) ON DELETE CASCADE,
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  "totalPurchased" NUMERIC(18,2) NOT NULL DEFAULT 0,
  "totalSpent" NUMERIC(18,2) NOT NULL DEFAULT 0,
  "lastRechargeDate" TIMESTAMPTZ,
  "lowBalanceThreshold" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);

-- LeadCreditTransactions
CREATE TABLE "LeadCreditTransaction" (
  id TEXT PRIMARY KEY,
  "sellerId" TEXT NOT NULL REFERENCES "Seller"(id) ON DELETE CASCADE,
  type "LeadCreditTxnType" NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  "orderId" TEXT,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "referenceId" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "LeadCreditTransaction_seller_type_idx" ON "LeadCreditTransaction"("sellerId", type);

-- LeadContactReveal (PII encrypted at app layer)
CREATE TABLE "LeadContactReveal" (
  id TEXT PRIMARY KEY,
  "sellerId" TEXT NOT NULL REFERENCES "Seller"(id) ON DELETE CASCADE,
  "buyLeadId" TEXT NOT NULL REFERENCES "BuyLead"(id) ON DELETE CASCADE,
  "buyerPhoneNumber" TEXT NOT NULL,
  "buyerEmail" TEXT NOT NULL,
  "buyerWhatsapp" TEXT NOT NULL,
  "buyerGstin" TEXT,
  "creditDeducted" BOOLEAN NOT NULL DEFAULT TRUE,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "LeadContactReveal_seller_lead_idx" ON "LeadContactReveal"("sellerId", "buyLeadId");

-- Orders
CREATE TABLE "Order" (
  id TEXT PRIMARY KEY,
  "buyerId" TEXT NOT NULL REFERENCES "Buyer"(id) ON DELETE CASCADE,
  "sellerId" TEXT NOT NULL REFERENCES "Seller"(id) ON DELETE CASCADE,
  "productId" TEXT REFERENCES "Product"(id) ON DELETE SET NULL,
  status "OrderStatus" NOT NULL DEFAULT 'QUOTED',
  "quotedPrice" NUMERIC(18,2),
  "negotiatedPrice" NUMERIC(18,2),
  "finalPrice" NUMERIC(18,2),
  "platformFacilitationFee" NUMERIC(18,2),
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paymentMethod" TEXT,
  "razorpayPaymentId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
CREATE INDEX "Order_buyer_status_idx" ON "Order"("buyerId", status);
CREATE INDEX "Order_seller_status_idx" ON "Order"("sellerId", status);
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");
CREATE INDEX "Order_created_desc_idx" ON "Order"("createdAt" DESC);

-- Quotes
CREATE TABLE "Quote" (
  id TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "Order"(id) ON DELETE CASCADE,
  "sellerId" TEXT NOT NULL REFERENCES "Seller"(id) ON DELETE CASCADE,
  "quotedPrice" NUMERIC(18,2) NOT NULL,
  "leadTime" TEXT,
  notes TEXT,
  status "QuoteStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ
);
CREATE INDEX "Quote_order_idx" ON "Quote"("orderId");
CREATE INDEX "Quote_seller_status_idx" ON "Quote"("sellerId", status);

-- AdminApprovals
CREATE TABLE "AdminApproval" (
  id TEXT PRIMARY KEY,
  "adminId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "entityType" "AdminEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  status "AdminApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "submittedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "reviewedAt" TIMESTAMPTZ,
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "AdminApproval_admin_entity_idx" ON "AdminApproval"("adminId", "entityType");
CREATE INDEX "AdminApproval_entity_status_idx" ON "AdminApproval"("entityId", status);

-- AuditLog
CREATE TABLE "AuditLog" (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  action "AuditAction" NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "AuditLog_user_entity_idx" ON "AuditLog"("userId", "entityType");
CREATE INDEX "AuditLog_entity_action_idx" ON "AuditLog"("entityId", action);
CREATE INDEX "AuditLog_created_desc_idx" ON "AuditLog"("createdAt" DESC);

-- NotificationPreferences
CREATE TABLE "NotificationPreferences" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
  "emailNotifications" BOOLEAN NOT NULL DEFAULT TRUE,
  "smsNotifications" BOOLEAN NOT NULL DEFAULT FALSE,
  "whatsappNotifications" BOOLEAN NOT NULL DEFAULT FALSE,
  "pushNotifications" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ComplaintTicket
CREATE TABLE "ComplaintTicket" (
  id TEXT PRIMARY KEY,
  "reporterId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "reportedUserId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
  attachments JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "resolvedAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
CREATE INDEX "ComplaintTicket_reporter_idx" ON "ComplaintTicket"("reporterId");
CREATE INDEX "ComplaintTicket_status_created_desc_idx" ON "ComplaintTicket"(status, "createdAt" DESC);
CREATE INDEX "ComplaintTicket_created_desc_idx" ON "ComplaintTicket"("createdAt" DESC);

-- FeatureFlag
CREATE TABLE "FeatureFlag" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  "isEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "rolloutPercentage" INT NOT NULL DEFAULT 0,
  "targetAudience" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row-level security placeholder (policy definitions can be added after creation)
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY;

