-- Nimbus schema — single-user app, no accounts.
-- Safe to run repeatedly (idempotent creates).

CREATE TABLE IF NOT EXISTS settings (
  id  SMALLINT PRIMARY KEY DEFAULT 1,
  tz  TEXT NOT NULL DEFAULT 'UTC',
  CONSTRAINT settings_singleton CHECK (id = 1)
);
INSERT INTO settings (id, tz) VALUES (1, 'UTC') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS tasks (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  detail       TEXT DEFAULT '',
  due_at       TIMESTAMPTZ,
  priority     SMALLINT NOT NULL DEFAULT 2,
  done         BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS tasks_idx ON tasks (done, due_at);

CREATE TABLE IF NOT EXISTS notes (
  id         SERIAL PRIMARY KEY,
  title      TEXT NOT NULL DEFAULT 'Untitled',
  body       TEXT NOT NULL DEFAULT '',
  pinned     BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notes_idx ON notes (pinned DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS events (
  id         SERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  location   TEXT DEFAULT '',
  start_at   TIMESTAMPTZ NOT NULL,
  end_at     TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_idx ON events (start_at);

CREATE TABLE IF NOT EXISTS messages (
  id         SERIAL PRIMARY KEY,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  image_url  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_idx ON messages (id DESC);

-- One-time cleanup if this schema is applied over the old multi-user version.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'user_id') THEN
    ALTER TABLE tasks DROP COLUMN user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'user_id') THEN
    ALTER TABLE notes DROP COLUMN user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'user_id') THEN
    ALTER TABLE events DROP COLUMN user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'user_id') THEN
    ALTER TABLE messages DROP COLUMN user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    DROP TABLE users CASCADE;
  END IF;
END $$;
