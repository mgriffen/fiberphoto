-- FiberPhoto: Initial Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- ============================================================
-- 1. Profiles table (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create a profile when a user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. Distribution Areas (DAs)
-- ============================================================
CREATE TABLE das (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_das_created_by ON das(created_by);
CREATE INDEX idx_das_updated_at ON das(updated_at);

-- ============================================================
-- 3. Fiber Structure Records
-- ============================================================
CREATE TABLE records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  da_id UUID NOT NULL REFERENCES das(id) ON DELETE CASCADE,
  sequence_num INTEGER NOT NULL,
  type_abbrev TEXT NOT NULL CHECK (type_abbrev IN ('FP', 'HH', 'BP')),
  structure_type TEXT NOT NULL,
  photo_url TEXT,
  has_sc BOOLEAN NOT NULL DEFAULT false,
  has_terminal BOOLEAN NOT NULL DEFAULT false,
  terminal_designation TEXT,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_records_da_id ON records(da_id);
CREATE INDEX idx_records_recorded_by ON records(recorded_by);
CREATE INDEX idx_records_updated_at ON records(updated_at);
CREATE INDEX idx_records_created_at ON records(created_at);
CREATE INDEX idx_records_type_abbrev ON records(type_abbrev);

-- ============================================================
-- 4. Row Level Security (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE das ENABLE ROW LEVEL SECURITY;
ALTER TABLE records ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles, update only their own
CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- DAs: all authenticated users can read all DAs, anyone can create, creator can update/delete
CREATE POLICY "Anyone can view DAs"
  ON das FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can create DAs"
  ON das FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator can update DA"
  ON das FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Creator can delete DA"
  ON das FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Records: all authenticated users can read all records, anyone can create, recorder can update/delete
CREATE POLICY "Anyone can view records"
  ON records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can create records"
  ON records FOR INSERT
  TO authenticated
  WITH CHECK (recorded_by = auth.uid());

CREATE POLICY "Recorder can update record"
  ON records FOR UPDATE
  TO authenticated
  USING (recorded_by = auth.uid());

CREATE POLICY "Recorder can delete record"
  ON records FOR DELETE
  TO authenticated
  USING (recorded_by = auth.uid());

-- ============================================================
-- 5. Storage bucket for photos
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', false);

-- Storage policies: authenticated users can upload/read/delete their own photos
CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Authenticated users can view all photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'photos');

CREATE POLICY "Users can delete own photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- 6. Updated_at auto-trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_das
  BEFORE UPDATE ON das
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_records
  BEFORE UPDATE ON records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
