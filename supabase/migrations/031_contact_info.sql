-- Add optional contact info to profiles (phone, Telegram, WhatsApp, etc.)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_info TEXT CHECK (char_length(contact_info) <= 100);
