DROP INDEX IF EXISTS `idx_qr_logins_ip`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_qr_logins_status`;--> statement-breakpoint
ALTER TABLE `otp_codes` DROP COLUMN `channel`;