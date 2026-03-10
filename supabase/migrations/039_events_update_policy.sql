-- #19: Allow organizers to update their own events
CREATE POLICY events_update ON events
  FOR UPDATE
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());
