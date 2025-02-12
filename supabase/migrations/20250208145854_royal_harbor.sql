/*
  # Optimize scraping and asset handling

  1. Changes
    - Add priority field to assets table
    - Add asset_priority enum type
    - Add indexes for better performance
    - Add screenshot_timestamp to versions table

  2. Security
    - Maintain existing RLS policies
*/

DO $$ 
BEGIN
  -- Create asset_priority enum if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_priority') THEN
    CREATE TYPE asset_priority AS ENUM ('high', 'medium', 'low');
  END IF;

  -- Add priority column to assets table if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assets' AND column_name = 'priority'
  ) THEN
    ALTER TABLE assets ADD COLUMN priority asset_priority DEFAULT 'medium';
  END IF;

  -- Add screenshot_timestamp to versions table if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'versions' AND column_name = 'screenshot_timestamp'
  ) THEN
    ALTER TABLE versions ADD COLUMN screenshot_timestamp timestamptz;
  END IF;

  -- Create index on priority if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'assets' AND indexname = 'idx_assets_priority'
  ) THEN
    CREATE INDEX idx_assets_priority ON assets(priority);
  END IF;

  -- Create composite index on type and priority if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'assets' AND indexname = 'idx_assets_type_priority'
  ) THEN
    CREATE INDEX idx_assets_type_priority ON assets(type, priority);
  END IF;
END $$;