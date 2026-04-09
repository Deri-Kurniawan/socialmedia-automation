import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// User table
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

// Session table
export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

// Account table (for Better Auth OAuth providers - Google login)
// This handles authentication only, not platform integrations
export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

// Integration Accounts table (for platform integrations like YouTube, Twitter, etc.)
// One user can have multiple integration accounts (e.g., multiple YouTube channels)
export const integrationAccount = sqliteTable(
  "integration_account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Platform type: "youtube", "twitter", "facebook", "instagram", etc.
    platform: text("platform").notNull(),
    // Account identifier on the platform (e.g., YouTube channel ID)
    // This is unique per user per platform - prevents duplicate channels
    externalAccountId: text("external_account_id").notNull(),
    // Display name for this integration (e.g., "My YouTube Channel")
    name: text("name"),
    // Account username/handle on the platform
    handle: text("handle"),
    // Google account that owns this integration (for multi-account support)
    // This tracks which Google OAuth account (from the account table) this integration belongs to
    googleAccountId: text("google_account_id"),
    // Google account email that owns this integration (for display/reference)
    googleAccountEmail: text("google_account_email"),
    // OAuth tokens for API access - stored per integration so each channel
    // maintains its own tokens even if Better Auth replaces the main account
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    // Token scope/permissions
    scope: text("scope"),
    // Account metadata (JSON) - profile picture URL, subscriber count, etc.
    metadata: text("metadata"),
    // Whether this integration is active
    isActive: integer("is_active", { mode: "boolean" })
      .default(true)
      .notNull(),
    // Is this the default account for this platform?
    isDefault: integer("is_default", { mode: "boolean" })
      .default(false)
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("integration_userId_idx").on(table.userId),
    index("integration_platform_idx").on(table.platform),
    index("integration_externalId_idx").on(table.externalAccountId),
    index("integration_user_platform_idx").on(table.userId, table.platform),
    // Index for efficient lookup of user's integrations by external account
    // Note: Multiple users CAN connect to the same external account (e.g., shared YouTube channel)
    // This index is NOT unique - uniqueness is enforced per-user in application logic
    index("integration_user_external_account_idx").on(table.userId, table.platform, table.externalAccountId),
    index("integration_active_idx").on(table.userId, table.isActive),
    // Index for grouping by Google account (used in getIntegrationsByGoogleAccount)
    index("integration_googleAccountId_idx").on(table.googleAccountId),
  ]
);

// Verification table (for email verification, password reset, etc.)
export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

// Upload History table (for tracking uploads across all platforms)
export const uploadHistory = sqliteTable(
  "upload_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Which integration account was used for this upload
    integrationAccountId: text("integration_account_id")
      .references(() => integrationAccount.id, { onDelete: "set null" }),
    // Platform: "youtube", "twitter", etc.
    platform: text("platform").notNull(),
    // Platform-specific video/post ID
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    tags: text("tags"), // JSON array of tags
    privacyStatus: text("privacy_status").notNull().default("public"),
    categoryId: text("category_id"),
    categoryName: text("category_name"),
    contentUrl: text("content_url").notNull(), // URL to view the content
    thumbnailUrl: text("thumbnail_url"),
    status: text("status").notNull().default("completed"), // completed, failed, processing, scheduled
    scheduledFor: integer("scheduled_for", { mode: "timestamp_ms" }), // For scheduled uploads
    fileSize: integer("file_size"), // in bytes
    duration: integer("duration"), // content duration in seconds
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("upload_history_userId_idx").on(table.userId),
    index("upload_history_integrationId_idx").on(table.integrationAccountId),
    index("upload_history_createdAt_idx").on(table.createdAt),
  ]
);

// Relations
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  integrationAccounts: many(integrationAccount),
  uploads: many(uploadHistory),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const integrationAccountRelations = relations(integrationAccount, ({ one, many }) => ({
  user: one(user, {
    fields: [integrationAccount.userId],
    references: [user.id],
  }),
  uploads: many(uploadHistory),
}));

export const uploadHistoryRelations = relations(uploadHistory, ({ one }) => ({
  user: one(user, {
    fields: [uploadHistory.userId],
    references: [user.id],
  }),
  integrationAccount: one(integrationAccount, {
    fields: [uploadHistory.integrationAccountId],
    references: [integrationAccount.id],
  }),
}));
