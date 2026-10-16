INSERT OR IGNORE INTO `settings` (`key`, `value`) VALUES ('report_token', lower(hex(randomblob(32))));
