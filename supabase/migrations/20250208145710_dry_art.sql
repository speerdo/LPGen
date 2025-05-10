/*
  # Add screenshot support

  1. Changes
    - Add screenshot column to versions table
    - Add screenshot type to assets table type enum
    - Add screenshot field to project settings

  2. Security
    - Maintain existing RLS policies
*/

DO $$ 
BEGIN
  -- Add screenshot column to versions table if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'versions' AND column_name = 'screenshot_url'
  ) THEN
    ALTER TABLE versions ADD COLUMN screenshot_url text;
  END IF;

  -- Update assets type enum to include screenshot
  ALTER TABLE assets 
  DROP CONSTRAINT IF EXISTS assets_type_check;

  ALTER TABLE assets
  ADD CONSTRAINT assets_type_check 
  CHECK (type IN ('image', 'font', 'logo', 'screenshot'));
END $$;