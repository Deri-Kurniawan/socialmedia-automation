DROP INDEX `integration_unique_channel_idx`;--> statement-breakpoint
CREATE INDEX `integration_user_external_account_idx` ON `integration_account` (`user_id`,`platform`,`external_account_id`);--> statement-breakpoint
CREATE INDEX `integration_googleAccountId_idx` ON `integration_account` (`google_account_id`);--> statement-breakpoint
ALTER TABLE `upload_history` ADD `scheduled_for` integer;