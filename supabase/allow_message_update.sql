-- Allow users to update their own messages (e.g. to mark as deleted)
-- Drop existing policy if it exists to avoid conflict
DROP POLICY IF EXISTS "Users Update Own Messages" ON messages;

CREATE POLICY "Users Update Own Messages" ON messages
FOR UPDATE
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Force schema reload
NOTIFY pgrst, 'reload schema';
