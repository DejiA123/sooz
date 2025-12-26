-- Function to get email by username for login
-- Run this in Supabase Dashboard > SQL Editor

CREATE OR REPLACE FUNCTION public.get_email_by_username(username_input text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER -- Use security definer to access auth.users
SET search_path = public
AS $$
DECLARE
  found_email text;
BEGIN
  -- Look up email in auth.users by joining with profiles on ID
  SELECT u.email INTO found_email
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE LOWER(p.username) = LOWER(username_input); -- Case insensitive
  
  RETURN found_email;
END;
$$;
