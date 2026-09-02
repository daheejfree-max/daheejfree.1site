-- ==============================================================================
-- DAHEEJFREE MATRIMONIAL PLATFORM: ACCOUNT HARD-DELETE POLICIES & CASCADE
-- ==============================================================================

-- 1. Enable RLS DELETE policy on public.profiles for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Authenticated users can delete their own profile'
  ) THEN
    CREATE POLICY "Authenticated users can delete their own profile"
    ON public.profiles
    FOR DELETE
    TO authenticated
    USING (auth.uid() = id);
  END IF;
END $$;

-- 2. Allow authenticated users to delete their own avatar objects in Supabase storage
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow users to delete their own avatars'
    ) THEN
      CREATE POLICY "Allow users to delete their own avatars"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);
    END IF;
  END IF;
END $$;
