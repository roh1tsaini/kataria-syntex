CREATE TABLE `rate_limits` (
	`key` text(120) PRIMARY KEY,
	`count` integer DEFAULT 0 NOT NULL,
	`window_start` text NOT NULL
);
