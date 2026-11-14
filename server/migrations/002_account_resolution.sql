ALTER TABLE accounts ADD COLUMN resolution_failures int NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN resolve_after timestamptz NOT NULL DEFAULT now();
