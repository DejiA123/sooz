-- Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Who triggered it (sender/liker)
    type TEXT NOT NULL CHECK (type IN ('message', 'like', 'comment', 'follow', 'mention')),
    reference_id UUID, -- ID of the message, post, etc.
    content TEXT, -- Preview text
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own notifications
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can update (mark as read) their own notifications
CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;


-- TRIGGER 1: New Message Notification
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER AS $$
DECLARE
    recipient_id UUID;
    sender_name TEXT;
BEGIN
    -- Get sender name for preview (optional, or handle in UI)
    -- Loop through participants of the conversation
    FOR recipient_id IN 
        SELECT user_id FROM conversation_participants 
        WHERE conversation_id = NEW.conversation_id 
        AND user_id != NEW.sender_id -- Don't notify self
    LOOP
        INSERT INTO public.notifications (user_id, actor_id, type, reference_id, content)
        VALUES (
            recipient_id,
            NEW.sender_id,
            'message',
            NEW.conversation_id, -- Link to conversation
            substring(NEW.content from 1 for 50) -- Preview
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_message ON public.messages;
CREATE TRIGGER on_new_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_message_notification();


-- TRIGGER 2: New Like Notification
-- Assumes you have a 'likes' table with (post_id, user_id)
-- Checks owner of post first
CREATE OR REPLACE FUNCTION public.handle_new_like_notification()
RETURNS TRIGGER AS $$
DECLARE
    post_owner_id UUID;
BEGIN
    SELECT user_id INTO post_owner_id FROM public.posts WHERE id = NEW.post_id;

    -- Don't notify if liking own post
    IF post_owner_id != NEW.user_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, reference_id, content)
        VALUES (
            post_owner_id,
            NEW.user_id,
            'like',
            NEW.post_id,
            'Liked your post'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_like ON public.likes;
CREATE TRIGGER on_new_like
    AFTER INSERT ON public.likes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_like_notification();
