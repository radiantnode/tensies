-- Tensies Attitude System (TAS) schema.
--
-- tas_personas: creative briefs for phrase generation (not read at runtime).
-- tas_phrases:  the lines TAS serves to players at runtime, cached in memory.

CREATE TABLE IF NOT EXISTS tas_personas (
    id          SERIAL PRIMARY KEY,
    mood        TEXT NOT NULL,
    snarkiness  TEXT NOT NULL,
    persona     TEXT NOT NULL,
    UNIQUE(mood, snarkiness)
);

CREATE TABLE IF NOT EXISTS tas_phrases (
    id          SERIAL PRIMARY KEY,
    phrase_type TEXT NOT NULL,
    mood        TEXT NOT NULL,
    snarkiness  TEXT NOT NULL,
    context_tag TEXT NOT NULL DEFAULT 'default',
    phrase      TEXT NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_tas_phrases_lookup
    ON tas_phrases (phrase_type, mood, snarkiness, context_tag)
    WHERE active;
