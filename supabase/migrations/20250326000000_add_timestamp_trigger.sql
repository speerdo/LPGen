/*
  # Add Timestamp Trigger for Subscriptions
  
  Adds an update timestamp trigger for the user_subscriptions table
  that may have been created in previous migrations.
*/

-- Create the timestamp function if it doesn't exist
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists (to avoid errors)
DROP TRIGGER IF EXISTS update_user_subscriptions_timestamp ON user_subscriptions;

-- Add the trigger
CREATE TRIGGER update_user_subscriptions_timestamp
BEFORE UPDATE ON user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_timestamp(); 
