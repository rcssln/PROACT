-- Add must_change_password column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- For new users, we want this to be TRUE by default when they are created via the invite flow.
-- Since the existing users should not be forced to change password (unless specified), 
-- we keep the default as FALSE for the column itself, and explicitly set it to TRUE in the application logic.
