CREATE TABLE `sync_changes` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tbl` text NOT NULL,
	`row_key` text NOT NULL,
	`changed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
