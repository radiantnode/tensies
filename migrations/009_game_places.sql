-- Game ↔ Google place association (the lobby "check in" feature). One row per
-- game (game_code PK); kept after the game ends as a record of where games
-- happened. The place_id index supports "games played at this place" lookups.
CREATE TABLE IF NOT EXISTS game_places (
    game_code      TEXT PRIMARY KEY,
    place_id       TEXT NOT NULL,
    place_name     TEXT NOT NULL,
    lat            DOUBLE PRECISION NOT NULL,
    lng            DOUBLE PRECISION NOT NULL,
    checked_in_by  TEXT,
    checked_in_ts  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_places_place ON game_places (place_id);
