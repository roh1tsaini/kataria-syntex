CREATE TABLE `color_recipe_ingredients` (
	`id` text(36) PRIMARY KEY,
	`recipe_id` text(36) NOT NULL,
	`seq` integer DEFAULT 0 NOT NULL,
	`name` text(120) NOT NULL,
	`quantity` real NOT NULL,
	`unit` text(20) DEFAULT 'g' NOT NULL,
	CONSTRAINT `fk_color_recipe_ingredients_recipe_id_color_recipes_id_fk` FOREIGN KEY (`recipe_id`) REFERENCES `color_recipes`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `color_recipe_versions` (
	`id` text(36) PRIMARY KEY,
	`recipe_id` text(36) NOT NULL,
	`version` integer NOT NULL,
	`payload` text NOT NULL,
	`restored_from` integer,
	`saved_by` text(36),
	`created_at` text NOT NULL,
	CONSTRAINT `fk_color_recipe_versions_recipe_id_color_recipes_id_fk` FOREIGN KEY (`recipe_id`) REFERENCES `color_recipes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_color_recipe_versions_saved_by_users_id_fk` FOREIGN KEY (`saved_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `color_recipes` (
	`id` text(36) PRIMARY KEY,
	`workspace_id` text(36) NOT NULL,
	`color_id` text(36) NOT NULL,
	`denier_id` text(36) NOT NULL,
	`process_temp_c` integer,
	`process_time_hrs` integer,
	`process_time_min` integer,
	`process_time_sec` integer,
	`notes` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text(36) NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_color_recipes_workspace_id_workspaces_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`),
	CONSTRAINT `fk_color_recipes_color_id_colors_id_fk` FOREIGN KEY (`color_id`) REFERENCES `colors`(`id`),
	CONSTRAINT `fk_color_recipes_denier_id_deniers_id_fk` FOREIGN KEY (`denier_id`) REFERENCES `deniers`(`id`),
	CONSTRAINT `fk_color_recipes_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_recipe_ingredients_recipe` ON `color_recipe_ingredients` (`recipe_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_recipe_versions_recipe_version` ON `color_recipe_versions` (`recipe_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_recipes_workspace_color_denier` ON `color_recipes` (`workspace_id`,`color_id`,`denier_id`);--> statement-breakpoint
CREATE INDEX `idx_recipes_workspace` ON `color_recipes` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_recipes_color` ON `color_recipes` (`color_id`);