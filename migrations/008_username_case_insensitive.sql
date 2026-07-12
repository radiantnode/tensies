-- Drop the separate lowercased username column. Keep a single `username`
-- field that preserves the original case the user typed, and enforce
-- case-insensitive uniqueness with a functional index on LOWER(username).

-- Create the case-insensitive unique index first so uniqueness is never
-- unprotected. (username_lower was already UNIQUE, so no LOWER() collisions
-- can exist among current rows.)
CREATE UNIQUE INDEX IF NOT EXISTS users_username_ci ON users (LOWER(username));

-- Dropping the column also drops its inline UNIQUE constraint
-- (users_username_lower_key) and the users_username_lower index.
ALTER TABLE users DROP COLUMN IF EXISTS username_lower;
