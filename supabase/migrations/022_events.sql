-- Migration 022: Group hikes / events

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  max_participants INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE event_participants (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

-- RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- Anyone can read events
CREATE POLICY "events_select" ON events FOR SELECT USING (true);
-- Authenticated users can create events
CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (auth.uid() = organizer_id);
-- Organizer can delete their own events
CREATE POLICY "events_delete" ON events FOR DELETE USING (auth.uid() = organizer_id);

-- Anyone can read participants
CREATE POLICY "event_participants_select" ON event_participants FOR SELECT USING (true);
-- Users can join/leave events
CREATE POLICY "event_participants_insert" ON event_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "event_participants_delete" ON event_participants FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX events_trail_id_idx ON events(trail_id);
CREATE INDEX events_scheduled_at_idx ON events(scheduled_at);
