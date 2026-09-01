ALTER TABLE `invites` ADD `expires_at` text;--> statement-breakpoint
ALTER TABLE `login_attempts` ADD `device_key` text(80) DEFAULT '' NOT NULL;