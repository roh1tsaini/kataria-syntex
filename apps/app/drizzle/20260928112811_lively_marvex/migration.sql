CREATE TABLE `devices` (
	`id` text(36) PRIMARY KEY,
	`user_id` text(36) NOT NULL,
	`label` text(100) NOT NULL,
	`platform` text(10) NOT NULL,
	`user_agent` text,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`revoked_at` text,
	CONSTRAINT `fk_devices_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` text(36) PRIMARY KEY,
	`phone` text(20) NOT NULL,
	`device_key` text(80) DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `otp_codes` (
	`id` text(36) PRIMARY KEY,
	`identifier` text NOT NULL,
	`code` text(64) NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` text NOT NULL,
	`verified_at` text,
	`consumed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `qr_logins` (
	`id` text(36) PRIMARY KEY,
	`code` text(64) NOT NULL UNIQUE,
	`status` text(10) DEFAULT 'pending' NOT NULL,
	`identifier` text,
	`granted_to` text(36),
	`approved_by` text(36),
	`approved_at` text,
	`claimed_at` text,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_qr_logins_granted_to_users_id_fk` FOREIGN KEY (`granted_to`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_qr_logins_approved_by_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text(120) PRIMARY KEY,
	`count` integer DEFAULT 0 NOT NULL,
	`window_start` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text(36) PRIMARY KEY,
	`device_id` text(36) NOT NULL,
	`token_hash` text(64) NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text,
	`revoked_at` text,
	CONSTRAINT `fk_sessions_device_id_devices_id_fk` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text(36) PRIMARY KEY,
	`phone` text(20),
	`email` text(200),
	`name` text(100) NOT NULL,
	`password_hash` text(200),
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_devices_user` ON `devices` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_login_attempts_phone` ON `login_attempts` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_otp_identifier` ON `otp_codes` (`identifier`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sessions_token_hash` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_device` ON `sessions` (`device_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_phone` ON `users` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);