import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
  boolean,
  customType,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

const createdAt = () => timestamp("createdAt", { mode: "date" }).notNull().defaultNow();
const updatedAt = () => timestamp("updatedAt", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date());
const bytea = customType({ dataType: () => "bytea" });
export const roleEnum = pgEnum("Role", ["BIDDER", "AUCTIONEER", "ADMIN"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  password: text("password").notNull(),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(),
  postalAddress: varchar("postalAddress", { length: 255 }),
  addressLine1: varchar("addressLine1", { length: 255 }),
  addressLine2: varchar("addressLine2", { length: 255 }),
  district: varchar("district", { length: 100 }),
  businessName: varchar("businessName", { length: 191 }),
  nationalId: varchar("nationalId", { length: 100 }),
  role: roleEnum("role").notNull().default("BIDDER"),
  isVerified: boolean("isVerified").notNull().default(false),
  mustChangePassword: boolean("mustChangePassword").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
  usedAt: timestamp("usedAt", { mode: "date" }),
  createdAt: createdAt(),
}, (table) => [index("password_reset_tokens_userId_idx").on(table.userId)]);

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  clientName: varchar("clientName", { length: 191 }),
  category: varchar("category", { length: 100 }).notNull().default("OTHER"),
  salesType: varchar("salesType", { length: 50 }).notNull().default("PROPERTY"),
  listingType: varchar("listingType", { length: 20 }).notNull().default("AUCTION"),
  salePrice: numeric("salePrice", { precision: 14, scale: 2 }),
  monthlyRent: numeric("monthlyRent", { precision: 14, scale: 2 }),
  rentDueDay: integer("rentDueDay"),
  lastRentReminderMonth: varchar("lastRentReminderMonth", { length: 7 }),
  isSold: boolean("isSold").notNull().default(false),
  isListed: boolean("isListed").notNull().default(true),
  attributes: jsonb("attributes").notNull().default({}),
  documentUrl: text("documentUrl"),
  createdById: integer("createdById").notNull().references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const auctionItems = pgTable("auction_items", {
  id: serial("id").primaryKey(),
  assetId: integer("assetId").notNull().references(() => assets.id, { onDelete: "cascade" }),
  reservePrice: numeric("reservePrice", { precision: 14, scale: 2 }).notNull(),
  startingBid: numeric("startingBid", { precision: 14, scale: 2 }).notNull(),
  depositAmount: numeric("depositAmount", { precision: 12, scale: 2 }).notNull(),
  biddingFee: numeric("biddingFee", { precision: 12, scale: 2 }).notNull().default("0"),
  startTime: timestamp("startTime", { mode: "date" }).notNull().defaultNow(),
  endTime: timestamp("endTime", { mode: "date" }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("UPCOMING"),
  liveRoomId: varchar("liveRoomId", { length: 100 }).unique(),
  reservePriceDisclosed: boolean("reservePriceDisclosed").notNull().default(false),
  listingNotifiedAt: timestamp("listingNotifiedAt", { mode: "date" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index("auction_items_status_idx").on(table.status)]);

export const assetImages = pgTable("asset_images", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  isPrimary: boolean("isPrimary").notNull().default(false),
  auctionItemId: integer("auctionItemId").notNull().references(() => auctionItems.id, { onDelete: "cascade" }),
});

export const assetImageData = pgTable("asset_image_data", {
  assetImageId: integer("assetImageId").primaryKey().references(() => assetImages.id, { onDelete: "cascade" }),
  contentType: varchar("contentType", { length: 100 }).notNull(),
  data: bytea("data").notNull(),
});

export const auctionRegistrations = pgTable("auction_registrations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  auctionItemId: integer("auctionItemId").notNull().references(() => auctionItems.id),
  status: varchar("status", { length: 32 }).notNull().default("PENDING"),
  createdAt: createdAt(),
}, (table) => [unique("auction_registrations_userId_auctionItemId_key").on(table.userId, table.auctionItemId)]);

export const dailySales = pgTable("daily_sales", {
  id: serial("id").primaryKey(),
  assetId: integer("assetId").notNull().references(() => assets.id, { onDelete: "cascade" }),
  price: numeric("price", { precision: 14, scale: 2 }).notNull(),
  stockCount: integer("stockCount").notNull().default(1),
  isAvailable: boolean("isAvailable").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  assetId: integer("assetId").notNull().references(() => assets.id),
  dailySaleId: integer("dailySaleId").references(() => dailySales.id),
  buyerId: integer("buyerId").notNull().references(() => users.id),
  sellerId: integer("sellerId").notNull().references(() => users.id),
  kind: varchar("kind", { length: 32 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  paymentRef: varchar("paymentRef", { length: 191 }).notNull().unique(),
  status: varchar("status", { length: 32 }).notNull().default("PENDING"),
  paidAt: timestamp("paidAt", { mode: "date" }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("sales_one_pending_property_per_asset_idx")
    .on(table.assetId)
    .where(sql`${table.kind} = 'PROPERTY_PURCHASE' AND ${table.status} = 'PENDING'`),
]);

export const auctionAccessPayments = pgTable("auction_access_payments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  auctionItemId: integer("auctionItemId").notNull().references(() => auctionItems.id, { onDelete: "cascade" }),
  feeType: varchar("feeType", { length: 50 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  paymentRef: varchar("paymentRef", { length: 191 }),
  status: varchar("status", { length: 50 }).notNull().default("PENDING"),
  paidAt: timestamp("paidAt", { mode: "date" }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("auction_access_payments_userId_auctionItemId_feeType_key").on(table.userId, table.auctionItemId, table.feeType),
  index("auction_access_payments_userId_status_idx").on(table.userId, table.status),
]);

export const auctionSettlements = pgTable("auction_settlements", {
  id: serial("id").primaryKey(),
  auctionItemId: integer("auctionItemId").notNull().unique().references(() => auctionItems.id, { onDelete: "cascade" }),
  winnerId: integer("winnerId").references(() => users.id),
  winningBidAmount: numeric("winningBidAmount", { precision: 14, scale: 2 }).notNull().default("0"),
  winnerEmailSentAt: timestamp("winnerEmailSentAt", { mode: "date" }),
  createdAt: createdAt(),
});

export const auctionRefunds = pgTable("auction_refunds", {
  id: serial("id").primaryKey(),
  auctionItemId: integer("auctionItemId").notNull().references(() => auctionItems.id, { onDelete: "cascade" }),
  accessPaymentId: integer("accessPaymentId").notNull().unique().references(() => auctionAccessPayments.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  reason: varchar("reason", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("PENDING"),
  gatewayReference: varchar("gatewayReference", { length: 191 }),
  processedById: integer("processedById").references(() => users.id),
  processedAt: timestamp("processedAt", { mode: "date" }),
  emailSentAt: timestamp("emailSentAt", { mode: "date" }),
  processedEmailSentAt: timestamp("processedEmailSentAt", { mode: "date" }),
  createdAt: createdAt(),
}, (table) => [
  index("auction_refunds_status_idx").on(table.status),
  index("auction_refunds_userId_idx").on(table.userId),
]);

export const bids = pgTable("bids", {
  id: serial("id").primaryKey(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  createdAt: createdAt(),
  isWinningBid: boolean("isWinningBid").notNull().default(false),
  bidderId: integer("bidderId").notNull().references(() => users.id),
  auctionItemId: integer("auctionItemId").notNull().references(() => auctionItems.id, { onDelete: "cascade" }),
}, (table) => [index("bids_auctionItemId_amount_idx").on(table.auctionItemId, table.amount.desc())]);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  reference: varchar("reference", { length: 191 }).notNull().unique(),
  gatewayStatus: varchar("gatewayStatus", { length: 191 }).notNull(),
  purpose: text("purpose").notNull(),
  receiptEmailSentAt: timestamp("receiptEmailSentAt", { mode: "date" }),
  createdAt: createdAt(),
});

export const usersRelations = relations(users, ({ many }) => ({
  bids: many(bids),
  payments: many(payments),
  assets: many(assets),
  registrations: many(auctionRegistrations),
  accessPayments: many(auctionAccessPayments),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  createdBy: one(users, { fields: [assets.createdById], references: [users.id] }),
  auctionItems: many(auctionItems),
  saleItems: many(dailySales),
}));

export const auctionItemsRelations = relations(auctionItems, ({ one, many }) => ({
  asset: one(assets, { fields: [auctionItems.assetId], references: [assets.id] }),
  bids: many(bids),
  images: many(assetImages),
  registrations: many(auctionRegistrations),
  accessPayments: many(auctionAccessPayments),
}));

export const assetImagesRelations = relations(assetImages, ({ one }) => ({
  auctionItem: one(auctionItems, { fields: [assetImages.auctionItemId], references: [auctionItems.id] }),
}));

export const auctionRegistrationsRelations = relations(auctionRegistrations, ({ one }) => ({
  user: one(users, { fields: [auctionRegistrations.userId], references: [users.id] }),
  auctionItem: one(auctionItems, { fields: [auctionRegistrations.auctionItemId], references: [auctionItems.id] }),
}));

export const dailySalesRelations = relations(dailySales, ({ one }) => ({
  asset: one(assets, { fields: [dailySales.assetId], references: [assets.id] }),
}));

export const auctionAccessPaymentsRelations = relations(auctionAccessPayments, ({ one }) => ({
  user: one(users, { fields: [auctionAccessPayments.userId], references: [users.id] }),
  auctionItem: one(auctionItems, { fields: [auctionAccessPayments.auctionItemId], references: [auctionItems.id] }),
}));

export const bidsRelations = relations(bids, ({ one }) => ({
  bidder: one(users, { fields: [bids.bidderId], references: [users.id] }),
  auctionItem: one(auctionItems, { fields: [bids.auctionItemId], references: [auctionItems.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
}));