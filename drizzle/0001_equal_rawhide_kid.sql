CREATE TABLE `sk_games` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`opponent` text,
	`played_on` text NOT NULL,
	`current_inning` integer DEFAULT 1 NOT NULL,
	`ended_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `sk_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sk_games_team_idx` ON `sk_games` (`team_id`);--> statement-breakpoint
CREATE TABLE `sk_inning_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`inning` integer NOT NULL,
	`runs_us` integer DEFAULT 0 NOT NULL,
	`runs_them` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `sk_games`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sk_runs_game_inning_idx` ON `sk_inning_runs` (`game_id`,`inning`);--> statement-breakpoint
CREATE TABLE `sk_lineup_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`player_id` text NOT NULL,
	`batting_order` integer NOT NULL,
	`scratched_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `sk_games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `sk_players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sk_lineup_game_idx` ON `sk_lineup_slots` (`game_id`);--> statement-breakpoint
CREATE TABLE `sk_plate_appearances` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`player_id` text NOT NULL,
	`lineup_slot_id` text NOT NULL,
	`outcome` text NOT NULL,
	`inning` integer NOT NULL,
	`seq` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `sk_games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `sk_players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lineup_slot_id`) REFERENCES `sk_lineup_slots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sk_pa_game_idx` ON `sk_plate_appearances` (`game_id`);--> statement-breakpoint
CREATE INDEX `sk_pa_player_idx` ON `sk_plate_appearances` (`player_id`);--> statement-breakpoint
CREATE TABLE `sk_players` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text NOT NULL,
	`number` text,
	`roster_order` integer NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `sk_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sk_players_team_idx` ON `sk_players` (`team_id`);--> statement-breakpoint
CREATE TABLE `sk_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
