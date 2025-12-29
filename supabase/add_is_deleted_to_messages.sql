-- Add is_deleted column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';
