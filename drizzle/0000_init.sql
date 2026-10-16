CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'Otros' NOT NULL,
	`requester` text,
	`checklist` text DEFAULT '[]' NOT NULL,
	`list` text NOT NULL,
	`later` integer DEFAULT false NOT NULL,
	`position` integer NOT NULL,
	`done_date` text,
	CONSTRAINT "done_date_iff_hecho" CHECK(("cards"."list" = 'hecho') = ("cards"."done_date" is not null)),
	CONSTRAINT "later_only_in_pendiente" CHECK("cards"."later" = 0 or "cards"."list" = 'pendiente')
);
--> statement-breakpoint
CREATE INDEX `cards_group` ON `cards` (`list`,`later`,`done_date`,`position`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
