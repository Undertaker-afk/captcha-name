CREATE TABLE `cringe_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`overall_score` integer NOT NULL,
	`sweat_rating` integer NOT NULL,
	`double_chin_rating` integer NOT NULL,
	`regret_rating` integer NOT NULL,
	`verdict` text NOT NULL,
	`roast` text NOT NULL,
	`created_at` integer
);
