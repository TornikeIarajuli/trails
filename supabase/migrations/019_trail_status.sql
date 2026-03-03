-- Migration 019: Trail status (open/closed/seasonal/maintenance)

ALTER TABLE trails
  ADD COLUMN status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'seasonal', 'maintenance')),
  ADD COLUMN status_note TEXT;
