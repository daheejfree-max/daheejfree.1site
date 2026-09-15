-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to start clean
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can do anything" ON public.profiles;
DROP POLICY IF EXISTS "Select own profile" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin full access" ON public.profiles;

-- Create restrictive SELECT policy: users can only see their own row
CREATE POLICY "Select own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Create restrictive UPDATE policy: users can only update their own row
CREATE POLICY "Update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- Create restrictive DELETE policy: users can only delete their own row
CREATE POLICY "Delete own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = id);

-- Create admin override policy: admins can do everything
CREATE POLICY "Admin full access" 
ON public.profiles 
FOR ALL 
USING (is_admin = true);

-- Important: Admins need to be able to authenticate and select to determine if they are an admin.
-- The "Select own profile" rule covers them reading their own row to check `is_admin = true`.
-- After they are known as admin, "Admin full access" allows them to see and manage others.
