/*
  # Add retries column to scraping_logs table

  1. Changes
    - Add `retries` column to track number of retry attempts for each scraping operation
    - Default value of 0 for backward compatibility
    - Allow NULL values for cases where retry count is not available
*/

DO $$ 
BEGIN
  -- Add retries column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scraping_logs' AND column_name = 'retries'
  ) THEN
    ALTER TABLE scraping_logs 
    ADD COLUMN retries integer DEFAULT 0;
  END IF;
END $$;