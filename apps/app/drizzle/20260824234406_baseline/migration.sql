CREATE TABLE `challan_item_sources` (
	`id` text(36) PRIMARY KEY,
	`challan_item_id` text(36) NOT NULL,
	`packing_item_id` text(36) NOT NULL,
	`qty_used` real NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_challan_item_sources_challan_item_id_challan_items_id_fk` FOREIGN KEY (`challan_item_id`) REFERENCES `challan_items`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_challan_item_sources_packing_item_id_packing_items_id_fk` FOREIGN KEY (`packing_item_id`) REFERENCES `packing_items`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `challan_items` (
	`id` text(36) PRIMARY KEY,
	`challan_id` text(36) NOT NULL,
	`seq` integer DEFAULT 0 NOT NULL,
	`denier_id` text(36),
	`denier_name` text(200) NOT NULL,
	`color_id` text(36),
	`color_name` text(200) NOT NULL,
	`color_code` text(100),
	`box_no` text(50) DEFAULT '' NOT NULL,
	`lot_no` text(50) DEFAULT '' NOT NULL,
	`cheese` integer DEFAULT 0 NOT NULL,
	`gross_wt` real DEFAULT 0 NOT NULL,
	`tare_wt` real DEFAULT 0 NOT NULL,
	`remarks` text DEFAULT '' NOT NULL,
	`boxes` integer DEFAULT 1 NOT NULL,
	`net_wt` real NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_challan_items_challan_id_challans_id_fk` FOREIGN KEY (`challan_id`) REFERENCES `challans`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_challan_items_denier_id_deniers_id_fk` FOREIGN KEY (`denier_id`) REFERENCES `deniers`(`id`),
	CONSTRAINT `fk_challan_items_color_id_colors_id_fk` FOREIGN KEY (`color_id`) REFERENCES `colors`(`id`)
);
--> statement-breakpoint
CREATE TABLE `challans` (
	`id` text(36) PRIMARY KEY,
	`workspace_id` text(36) NOT NULL,
	`financial_year_id` text(36) NOT NULL,
	`type` text(10) DEFAULT 'sales' NOT NULL,
	`challan_number` text(50) NOT NULL,
	`date` text NOT NULL,
	`customer_id` text(36),
	`customer_name` text(200),
	`customer_gstin` text(15),
	`job_worker_id` text(36),
	`job_worker_name` text(200),
	`notes` text,
	`total_boxes` integer DEFAULT 0 NOT NULL,
	`total_cheese` integer DEFAULT 0 NOT NULL,
	`total_gross_wt` real DEFAULT 0 NOT NULL,
	`total_tare_wt` real DEFAULT 0 NOT NULL,
	`total_net_wt` real DEFAULT 0 NOT NULL,
	`created_by` text(36) NOT NULL,
	`client_ref` text(60),
	`origin_device` text(120),
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_challans_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`),
	CONSTRAINT `fk_challans_financial_year_id_financial_years_id_fk` FOREIGN KEY (`financial_year_id`) REFERENCES `financial_years`(`id`),
	CONSTRAINT `fk_challans_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`),
	CONSTRAINT `fk_challans_job_worker_id_job_workers_id_fk` FOREIGN KEY (`job_worker_id`) REFERENCES `job_workers`(`id`),
	CONSTRAINT `fk_challans_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `colors` (
	`id` text(36) PRIMARY KEY,
	`workspace_id` text(36) NOT NULL,
	`name` text(200) NOT NULL,
	`code` text(100),
	`stock_type` text(4) DEFAULT 'dyed' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_colors_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text(36) PRIMARY KEY,
	`workspace_id` text(36) NOT NULL UNIQUE,
	`name` text(100) NOT NULL,
	`gstin` text(15),
	`pan` text(10),
	`address` text,
	`phone_1` text(20),
	`phone_2` text(20),
	`numbering` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text(36),
	CONSTRAINT `fk_companies_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`),
	CONSTRAINT `fk_companies_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text(36) PRIMARY KEY,
	`workspace_id` text(36) NOT NULL,
	`name` text(200) NOT NULL,
	`phone` text(20),
	`address` text,
	`gstin` text(15),
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_customers_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`)
);
--> statement-breakpoint
CREATE TABLE `deniers` (
	`id` text(36) PRIMARY KEY,
	`workspace_id` text(36) NOT NULL,
	`name` text(200) NOT NULL,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_deniers_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `financial_years` (
	`id` text(36) PRIMARY KEY,
	`workspace_id` text(36) NOT NULL,
	`label` text(10) NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`sales_next` integer DEFAULT 1 NOT NULL,
	`outward_next` integer DEFAULT 1 NOT NULL,
	`packing_sale_next` integer DEFAULT 1 NOT NULL,
	`packing_job_next` integer DEFAULT 1 NOT NULL,
	`raw_next` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_financial_years_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`)
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text(36) PRIMARY KEY,
	`workspace_id` text(36) NOT NULL,
	`phone` text(20) NOT NULL,
	`permissions` text NOT NULL,
	`code` text(10) NOT NULL UNIQUE,
	`invited_by` text(36) NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_invites_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`),
	CONSTRAINT `fk_invites_invited_by_users_id_fk` FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_work_return_items` (
	`id` text(36) PRIMARY KEY,
	`return_id` text(36) NOT NULL,
	`challan_id` text(36) NOT NULL,
	`seq` integer DEFAULT 0 NOT NULL,
	`denier_id` text(36),
	`denier_name` text(200) NOT NULL,
	`color_id` text(36),
	`color_name` text(200) NOT NULL,
	`color_code` text(100),
	`lot_no` text(100) DEFAULT '' NOT NULL,
	`net_wt` real NOT NULL,
	`cones` integer,
	`over_receipt` integer DEFAULT false NOT NULL,
	`over_receipt_qty` real,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_job_work_return_items_return_id_job_work_returns_id_fk` FOREIGN KEY (`return_id`) REFERENCES `job_work_returns`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_job_work_return_items_challan_id_challans_id_fk` FOREIGN KEY (`challan_id`) REFERENCES `challans`(`id`),
	CONSTRAINT `fk_job_work_return_items_denier_id_deniers_id_fk` FOREIGN KEY (`denier_id`) REFERENCES `deniers`(`id`),
	CONSTRAINT `fk_job_work_return_items_color_id_colors_id_fk` FOREIGN KEY (`color_id`) REFERENCES `colors`(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_work_returns` (
	`id` text(36) PRIMARY KEY,
	`workspace_id` text(36) NOT NULL,
	`job_worker_id` text(36) NOT NULL,
	`job_worker_name` text(200) NOT NULL,
	`invoice_no` text(100) NOT NULL,
	`date` text NOT NULL,
	`remarks` text,
	`received_by` text(36) NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_job_work_returns_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`),
	CONSTRAINT `fk_job_work_returns_job_worker_id_job_workers_id_fk` FOREIGN KEY (`job_worker_id`) REFERENCES `job_workers`(`id`),
	CONSTRAINT `fk_job_work_returns_received_by_users_id_fk` FOREIGN KEY (`received_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_workers` (
	`id` text(36) PRIMARY KEY,
	`workspace_id` text(36) NOT NULL,
	`name` text(200) NOT NULL,
	`phone` text(20),
	`address` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_job_workers_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`)
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` text(36) PRIMARY KEY,
	`phone` text(20) NOT NULL,
	`ok` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `member_permissions` (
	`user_id` text(36) NOT NULL,
	`workspace_id` text(36) NOT NULL,
	`permission` text(40) NOT NULL,
	CONSTRAINT `member_permissions_pk` PRIMARY KEY(`user_id`, `workspace_id`, `permission`),
	CONSTRAINT `fk_member_permissions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_member_permissions_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`)
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`user_id` text(36) NOT NULL,
	`workspace_id` text(36) NOT NULL,
	`is_primary_admin` integer DEFAULT false NOT NULL,
	`joined_at` text NOT NULL,
	CONSTRAINT `memberships_pk` PRIMARY KEY(`user_id`, `workspace_id`),
	CONSTRAINT `fk_memberships_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_memberships_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`)
);
--> statement-breakpoint
CREATE TABLE `otp_codes` (
	`id` text(36) PRIMARY KEY,
	`phone` text(20) NOT NULL,
	`code` text(10) NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` text NOT NULL,
	`verified_at` text,
	`consumed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `packing_entries` (
	`id` text(36) PRIMARY KEY,
	`workspace_id` text(36) NOT NULL,
	`financial_year_id` text(36) NOT NULL,
	`type` text(10) NOT NULL,
	`entry_number` text(50) NOT NULL,
	`date` text NOT NULL,
	`created_by` text(36) NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_packing_entries_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`),
	CONSTRAINT `fk_packing_entries_financial_year_id_financial_years_id_fk` FOREIGN KEY (`financial_year_id`) REFERENCES `financial_years`(`id`),
	CONSTRAINT `fk_packing_entries_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `packing_items` (
	`id` text(36) PRIMARY KEY,
	`entry_id` text(36) NOT NULL,
	`seq` integer DEFAULT 0 NOT NULL,
	`denier_id` text(36),
	`denier_name` text(200) NOT NULL,
	`color_id` text(36),
	`color_name` text(200) NOT NULL,
	`color_code` text(100),
	`tare_wt` real,
	`gross_wt` real,
	`sack_wt` real,
	`sacks` integer,
	`cones` integer,
	`box_no` text(50),
	`lot_no` text(100),
	`remarks` text,
	`net_wt` real NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_packing_items_entry_id_packing_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `packing_entries`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_packing_items_denier_id_deniers_id_fk` FOREIGN KEY (`denier_id`) REFERENCES `deniers`(`id`),
	CONSTRAINT `fk_packing_items_color_id_colors_id_fk` FOREIGN KEY (`color_id`) REFERENCES `colors`(`id`)
);
--> statement-breakpoint
CREATE TABLE `pair_codes` (
	`id` text(36) PRIMARY KEY,
	`code` text(12) NOT NULL UNIQUE,
	`created_by` text(36) NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_pair_codes_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `qr_logins` (
	`id` text(36) PRIMARY KEY,
	`code` text(64) NOT NULL UNIQUE,
	`ip` text(45) NOT NULL,
	`status` text(10) DEFAULT 'pending' NOT NULL,
	`approved_by` text(36),
	`approved_at` text,
	`claimed_at` text,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_qr_logins_approved_by_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `raw_material_entries` (
	`id` text(36) PRIMARY KEY,
	`workspace_id` text(36) NOT NULL,
	`financial_year_id` text(36) NOT NULL,
	`entry_number` text(50) NOT NULL,
	`supplier_id` text(36),
	`supplier_name` text(200),
	`supplier_challan_no` text(100),
	`date` text NOT NULL,
	`notes` text,
	`created_by` text(36) NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_raw_material_entries_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`),
	CONSTRAINT `fk_raw_material_entries_financial_year_id_financial_years_id_fk` FOREIGN KEY (`financial_year_id`) REFERENCES `financial_years`(`id`),
	CONSTRAINT `fk_raw_material_entries_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`),
	CONSTRAINT `fk_raw_material_entries_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `raw_material_items` (
	`id` text(36) PRIMARY KEY,
	`entry_id` text(36) NOT NULL,
	`seq` integer DEFAULT 0 NOT NULL,
	`denier_id` text(36),
	`denier_name` text(200) NOT NULL,
	`color_id` text(36),
	`color_name` text(200) NOT NULL,
	`color_code` text(100),
	`net_wt` real NOT NULL,
	`gross_wt` real,
	`tare_wt` real,
	`cones` integer,
	`lot_no` text(100) DEFAULT '' NOT NULL,
	`box_no` text(60),
	`packing_unit` text(10),
	`packing_count` integer,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_raw_material_items_entry_id_raw_material_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `raw_material_entries`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_raw_material_items_denier_id_deniers_id_fk` FOREIGN KEY (`denier_id`) REFERENCES `deniers`(`id`),
	CONSTRAINT `fk_raw_material_items_color_id_colors_id_fk` FOREIGN KEY (`color_id`) REFERENCES `colors`(`id`)
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
CREATE TABLE `stock_entries` (
	`id` text(36) PRIMARY KEY,
	`workspace_id` text(36) NOT NULL,
	`stock_type` text(4) NOT NULL,
	`denier_id` text(36),
	`denier_name` text(200) NOT NULL,
	`color_id` text(36),
	`color_name` text(200) NOT NULL,
	`color_code` text(100),
	`lot_no` text(100) DEFAULT '' NOT NULL,
	`movement` text(4) NOT NULL,
	`source` text(20) NOT NULL,
	`source_ref_id` text(36) NOT NULL,
	`net_wt` real NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_stock_entries_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text(36) PRIMARY KEY,
	`workspace_id` text(36) NOT NULL,
	`name` text(200) NOT NULL,
	`phone` text(20),
	`address` text,
	`gstin` text(15),
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_suppliers_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text(36) PRIMARY KEY,
	`phone` text(20) NOT NULL,
	`name` text(100) NOT NULL,
	`password_hash` text(200) NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text(36) PRIMARY KEY,
	`name` text(100) NOT NULL,
	`created_by` text(36) NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_workspaces_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_sources_packing_item` ON `challan_item_sources` (`packing_item_id`);--> statement-breakpoint
CREATE INDEX `idx_sources_challan_item` ON `challan_item_sources` (`challan_item_id`);--> statement-breakpoint
CREATE INDEX `idx_challan_items_challan` ON `challan_items` (`challan_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_challans_workspace_number` ON `challans` (`workspace_id`,`financial_year_id`,`challan_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_challans_workspace_client_ref` ON `challans` (`workspace_id`,`client_ref`);--> statement-breakpoint
CREATE INDEX `idx_challans_workspace_fy` ON `challans` (`workspace_id`,`financial_year_id`);--> statement-breakpoint
CREATE INDEX `idx_challans_workspace_date` ON `challans` (`workspace_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_colors_workspace` ON `colors` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_customers_workspace` ON `customers` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_deniers_workspace` ON `deniers` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_devices_user` ON `devices` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_fy_workspace_label` ON `financial_years` (`workspace_id`,`label`);--> statement-breakpoint
CREATE INDEX `idx_invites_workspace` ON `invites` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_invites_phone` ON `invites` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_return_items_return` ON `job_work_return_items` (`return_id`);--> statement-breakpoint
CREATE INDEX `idx_return_items_challan` ON `job_work_return_items` (`challan_id`);--> statement-breakpoint
CREATE INDEX `idx_returns_workspace` ON `job_work_returns` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_returns_job_worker` ON `job_work_returns` (`job_worker_id`);--> statement-breakpoint
CREATE INDEX `idx_returns_date` ON `job_work_returns` (`date`);--> statement-breakpoint
CREATE INDEX `idx_job_workers_workspace` ON `job_workers` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_login_attempts_phone` ON `login_attempts` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_member_perms_workspace` ON `member_permissions` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_otp_phone` ON `otp_codes` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_packing_workspace_number` ON `packing_entries` (`workspace_id`,`financial_year_id`,`entry_number`);--> statement-breakpoint
CREATE INDEX `idx_packing_workspace_type` ON `packing_entries` (`workspace_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_packing_workspace_date` ON `packing_entries` (`workspace_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_packing_created_by` ON `packing_entries` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_packing_items_entry` ON `packing_items` (`entry_id`);--> statement-breakpoint
CREATE INDEX `idx_pair_codes_created_by` ON `pair_codes` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_qr_logins_ip` ON `qr_logins` (`ip`);--> statement-breakpoint
CREATE INDEX `idx_qr_logins_status` ON `qr_logins` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_raw_workspace_number` ON `raw_material_entries` (`workspace_id`,`financial_year_id`,`entry_number`);--> statement-breakpoint
CREATE INDEX `idx_raw_workspace_date` ON `raw_material_entries` (`workspace_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_raw_items_entry` ON `raw_material_items` (`entry_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sessions_token_hash` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_device` ON `sessions` (`device_id`);--> statement-breakpoint
CREATE INDEX `idx_stock_workspace_type` ON `stock_entries` (`workspace_id`,`stock_type`);--> statement-breakpoint
CREATE INDEX `idx_stock_workspace_date` ON `stock_entries` (`workspace_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_stock_source` ON `stock_entries` (`source`,`source_ref_id`);--> statement-breakpoint
CREATE INDEX `idx_stock_denier_color` ON `stock_entries` (`workspace_id`,`denier_id`,`color_id`);--> statement-breakpoint
CREATE INDEX `idx_suppliers_workspace` ON `suppliers` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_phone` ON `users` (`phone`);