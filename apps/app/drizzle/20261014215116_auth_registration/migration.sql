CREATE TABLE `app_settings` (
	`key` text(80) PRIMARY KEY,
	`value` text(200) NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `qr_logins` ADD `claim_secret_hash` text(64) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `qr_logins` ADD `device_label` text(100) DEFAULT '' NOT NULL;--> statement-breakpoint
-- Password is mandatory from here on. Signup used to accept none, so those
-- accounts hold NULL and would abort this copy into a NOT NULL column and take
-- the whole migration down with it. '!' is not a parseable argon2id string, so
-- decodeHash rejects it and those accounts keep OTP-only login — which is
-- exactly what the old NULL meant too.
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text(36) PRIMARY KEY,
	`phone` text(20),
	`email` text(200),
	`name` text(100) NOT NULL,
	`password_hash` text(200) NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`(`id`,`phone`,`email`,`name`,`password_hash`,`created_at`,`updated_at`) SELECT `id`,`phone`,`email`,`name`,COALESCE(`password_hash`,'!'),`created_at`,`updated_at` FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_login_attempts_phone`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_phone` ON `users` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
-- Failed password logins were only ever written here, never read; the atomic
-- rate_limits budgets are the actual control.
DROP TABLE `login_attempts`;