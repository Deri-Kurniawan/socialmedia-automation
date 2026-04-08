CREATE TABLE `integration_account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`external_account_id` text NOT NULL,
	`name` text,
	`handle` text,
	`google_account_email` text,
	`access_token` text,
	`refresh_token` text,
	`access_token_expires_at` integer,
	`scope` text,
	`metadata` text,
	`is_active` integer DEFAULT true NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `integration_userId_idx` ON `integration_account` (`user_id`);--> statement-breakpoint
CREATE INDEX `integration_platform_idx` ON `integration_account` (`platform`);--> statement-breakpoint
CREATE INDEX `integration_externalId_idx` ON `integration_account` (`external_account_id`);--> statement-breakpoint
CREATE INDEX `integration_user_platform_idx` ON `integration_account` (`user_id`,`platform`);--> statement-breakpoint
CREATE INDEX `integration_unique_channel_idx` ON `integration_account` (`user_id`,`platform`,`external_account_id`);--> statement-breakpoint
CREATE INDEX `integration_active_idx` ON `integration_account` (`user_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `upload_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`integration_account_id` text,
	`platform` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`tags` text,
	`privacy_status` text DEFAULT 'public' NOT NULL,
	`category_id` text,
	`category_name` text,
	`content_url` text NOT NULL,
	`thumbnail_url` text,
	`status` text DEFAULT 'completed' NOT NULL,
	`file_size` integer,
	`duration` integer,
	`error_message` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`integration_account_id`) REFERENCES `integration_account`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `upload_history_userId_idx` ON `upload_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `upload_history_integrationId_idx` ON `upload_history` (`integration_account_id`);--> statement-breakpoint
CREATE INDEX `upload_history_createdAt_idx` ON `upload_history` (`created_at`);