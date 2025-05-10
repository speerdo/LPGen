-- Migration to add subscription and token transaction tables
-- This ensures the tables required for the token system exist

-- Create user_subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    plan_type TEXT NOT NULL DEFAULT 'free',
    token_balance INTEGER NOT NULL DEFAULT 100,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    next_reset_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    -- Add foreign key constraint if your users table exists
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);

-- Create token_transactions table for auditing and tracking token usage
CREATE TABLE IF NOT EXISTS token_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    amount INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    -- Add foreign key constraint if your users table exists
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);

-- Add RLS policies for security
-- Enable RLS on tables
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read only their own subscription data
CREATE POLICY "Users can view their own subscription"
    ON user_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Policy to allow users to read only their own transaction data
CREATE POLICY "Users can view their own transactions"
    ON token_transactions FOR SELECT
    USING (auth.uid() = user_id);

-- Policy to allow service role to manage all data
CREATE POLICY "Service role can manage subscriptions"
    ON user_subscriptions
    USING (current_setting('role') = 'service_role');

CREATE POLICY "Service role can manage transactions"
    ON token_transactions
    USING (current_setting('role') = 'service_role');

-- Add RPC function to update token balance 
-- This can be called from the client with limited permissions
CREATE OR REPLACE FUNCTION update_token_balance(user_id UUID, new_balance INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Get the current user ID from auth context
    current_user_id := auth.uid();
    
    -- Only allow users to update their own token balance or admins
    IF current_user_id = user_id OR current_setting('role') = 'service_role' THEN
        UPDATE user_subscriptions 
        SET token_balance = new_balance, 
            updated_at = NOW()
        WHERE user_id = user_id;
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
