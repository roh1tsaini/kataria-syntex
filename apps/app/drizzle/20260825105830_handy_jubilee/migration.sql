ALTER TABLE `invites` ADD `email` text(200);--> statement-breakpoint
ALTER TABLE `otp_codes` ADD `identifier` text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `otp_codes` ADD `channel` text(5) DEFAULT 'sms' NOT NULL;--> statement-breakpoint
ALTER TABLE `qr_logins` ADD `identifier` text;--> statement-breakpoint
ALTER TABLE `qr_logins` ADD `granted_to` text(36) REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `users` ADD `email` text(200);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_invites` (
	`id` text(36) PRIMARY KEY,
	`workspace_id` text(36) NOT NULL,
	`phone` text(20),
	`email` text(200),
	`permissions` text NOT NULL,
	`invited_by` text(36) NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_invites_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`),
	CONSTRAINT `fk_invites_invited_by_users_id_fk` FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_invites`(`id`, `workspace_id`, `phone`, `permissions`, `invited_by`, `consumed_at`, `created_at`) SELECT `id`, `workspace_id`, `phone`, `permissions`, `invited_by`, `consumed_at`, `created_at` FROM `invites`;--> statement-breakpoint
DROP TABLE `invites`;--> statement-breakpoint
ALTER TABLE `__new_invites` RENAME TO `invites`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text(36) PRIMARY KEY,
	`phone` text(20),
	`email` text(200),
	`name` text(100) NOT NULL,
	`password_hash` text(200),
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`(`id`, `phone`, `name`, `password_hash`, `created_at`, `updated_at`) SELECT `id`, `phone`, `name`, `password_hash`, `created_at`, `updated_at` FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_otp_phone`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_pair_codes_created_by`;--> statement-breakpoint
CREATE INDEX `idx_invites_workspace` ON `invites` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_invites_phone` ON `invites` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_invites_email` ON `invites` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_phone` ON `users` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_otp_identifier` ON `otp_codes` (`identifier`);--> statement-breakpoint
DROP TABLE `pair_codes`;--> statement-breakpoint
ALTER TABLE `otp_codes` DROP COLUMN `phone`;