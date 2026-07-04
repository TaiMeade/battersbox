CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`opponent` text,
	`played_on` text NOT NULL,
	`notes` text,
	`ended_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `games_season_idx` ON `games` (`season_id`);--> statement-breakpoint
CREATE TABLE `plate_appearances` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`player_id` text NOT NULL,
	`outcome` text NOT NULL,
	`seq` integer NOT NULL,
	`spray_x` real,
	`spray_y` real,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pa_game_idx` ON `plate_appearances` (`game_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sport` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
