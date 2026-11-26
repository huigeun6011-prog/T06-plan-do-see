CREATE TABLE IF NOT EXISTS ping (
  id bigserial PRIMARY KEY,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
