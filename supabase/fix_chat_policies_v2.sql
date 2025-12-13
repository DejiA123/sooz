-- FIX CHAT POLICIES V2 (ROBUST)
-- 1. Nuke existing policies to ensure clean slate (Dynamic SQL)
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop policies on conversation_participants
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'conversation_participants') LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON conversation_participants';
  END LOOP;
  
  -- Drop policies on conversations
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'conversations') LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON conversations';
  END LOOP;
END $$;

-- 2. Helper Function (Ensure it exists)
CREATE OR REPLACE FUNCTION public.is_chat_member(target_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM conversation_participants 
    WHERE conversation_id = target_conversation_id 
    AND user_id = auth.uid()
  );
END;
$$;

-- 3. Simplified "Metadata Public, Content Private" Policies
-- This avoids recursion and "Creator can't see own chat" issues.

-- Conversations: Public read (Metadata), Authenticated create
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public View Conversations" ON conversations FOR SELECT USING (true);
CREATE POLICY "Auth Insert Conversations" ON conversations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Participants: Public read (Who is in what chat), Authenticated create
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public View Participants" ON conversation_participants FOR SELECT USING (true);
CREATE POLICY "Auth Insert Participants" ON conversation_participants FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Messages: RESTRICTED (Only members can view)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- Drop old message policies just in case
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'messages') LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON messages';
  END LOOP;
END $$;

CREATE POLICY "Member View Messages" ON messages FOR SELECT USING (is_chat_member(conversation_id));
CREATE POLICY "Member Insert Messages" ON messages FOR INSERT WITH CHECK (is_chat_member(conversation_id));
