-- FIX FOR CHAT INFINITE RECURSION ERROR
-- Run this entire script in your Supabase Dashboard > SQL Editor

-- 1. Create a secure helper function to check chat membership without recursion
CREATE OR REPLACE FUNCTION public.is_chat_member(target_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- IMPORTANT: This bypasses RLS to avoid the recursion loop
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

-- 2. Clean up existing problematic policies
-- We try to drop common policy names. If you still get errors, manually delete policies on 'conversation_participants' in the dashboard.
DROP POLICY IF EXISTS "Enable read access for all users" ON conversation_participants;
DROP POLICY IF EXISTS "Enable insert for all users" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can insert participants" ON conversation_participants;
DROP POLICY IF EXISTS "view_participants" ON conversation_participants;
DROP POLICY IF EXISTS "insert_participants" ON conversation_participants;

-- 3. Apply NEW Safe Policies for Participants
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Safe View Participants" ON conversation_participants
FOR SELECT
USING (
  -- Users can see themselves OR other members of chats they belong to (via the secure function)
  user_id = auth.uid() OR is_chat_member(conversation_id)
);

CREATE POLICY "Safe Insert Participants" ON conversation_participants
FOR INSERT
-- Allow authenticated users to add participants (necessary for group creation)
WITH CHECK (auth.role() = 'authenticated');

-- 4. Apply Safe Policies for Messages (Optional but Good Practice)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Safe View Messages" ON messages
FOR SELECT
USING (is_chat_member(conversation_id));

CREATE POLICY "Safe Insert Messages" ON messages
FOR INSERT
WITH CHECK (is_chat_member(conversation_id));
