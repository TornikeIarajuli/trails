-- Migration 023: Emergency contacts

ALTER TABLE profiles
  ADD COLUMN emergency_contact_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
