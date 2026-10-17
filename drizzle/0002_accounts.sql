CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`name` text NOT NULL,
	`password_hash` text,
	`role` text NOT NULL,
	`session_version` integer DEFAULT 0 NOT NULL,
	`disabled` integer DEFAULT false NOT NULL,
	`report_token` text DEFAULT (lower(hex(randomblob(32)))) NOT NULL,
	CONSTRAINT "email_lowercase" CHECK("users"."email" = lower("users"."email")),
	CONSTRAINT "role_known" CHECK("users"."role" in ('admin', 'member'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_report_token_unique` ON `users` (`report_token`);--> statement-breakpoint
INSERT INTO `users` (`id`, `name`, `role`, `report_token`) VALUES (
	'00000000-0000-4000-8000-000000000001',
	'Propietario',
	'admin',
	coalesce((SELECT `value` FROM `settings` WHERE `key` = 'report_token'), lower(hex(randomblob(32))))
);--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
CREATE TABLE `labels` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "color_known" CHECK("labels"."color" in ('green', 'yellow', 'orange', 'red', 'purple', 'blue'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `labels_user_name` ON `labels` (`user_id`,`name`);--> statement-breakpoint
INSERT INTO `labels` (`id`, `user_id`, `name`, `color`) VALUES
	(lower(hex(randomblob(16))), '00000000-0000-4000-8000-000000000001', 'Desarrollo', 'green'),
	(lower(hex(randomblob(16))), '00000000-0000-4000-8000-000000000001', 'Cursos', 'purple');--> statement-breakpoint
CREATE TABLE `links` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`user_id` text,
	`role` text,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "link_kind_fields" CHECK(("links"."kind" = 'invite' and "links"."role" is not null and "links"."user_id" is null)
        or ("links"."kind" = 'reset' and "links"."user_id" is not null and "links"."role" is null))
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`email` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`window_start` integer NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER `login_attempts_prune` AFTER INSERT ON `login_attempts` BEGIN
	DELETE FROM `login_attempts`
	WHERE `window_start` <= NEW.`window_start` - 900 AND `locked_until` <= NEW.`window_start`;
END;
--> statement-breakpoint
CREATE TABLE `__new_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`label_id` text,
	`requester` text,
	`checklist` text DEFAULT '[]' NOT NULL,
	`list` text NOT NULL,
	`position` integer NOT NULL,
	`done_date` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "done_date_iff_hecho" CHECK(("__new_cards"."list" = 'hecho') = ("__new_cards"."done_date" is not null))
);
--> statement-breakpoint
INSERT INTO `__new_cards` (`id`, `user_id`, `title`, `description`, `label_id`, `requester`, `checklist`, `list`, `position`, `done_date`)
SELECT
	`id`,
	'00000000-0000-4000-8000-000000000001',
	`title`,
	`description`,
	(SELECT `labels`.`id` FROM `labels` WHERE `labels`.`name` = `cards`.`category`),
	`requester`,
	`checklist`,
	CASE WHEN `list` = 'pendiente' AND `later` = 0 THEN 'esta_semana' ELSE `list` END,
	`position`,
	`done_date`
FROM `cards`;--> statement-breakpoint
DROP TABLE `cards`;--> statement-breakpoint
ALTER TABLE `__new_cards` RENAME TO `cards`;--> statement-breakpoint
CREATE INDEX `cards_group` ON `cards` (`user_id`,`list`,`done_date`,`position`);
