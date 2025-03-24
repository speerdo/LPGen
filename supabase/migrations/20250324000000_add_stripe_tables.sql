-- Create table for user subscriptions
CREATE TABLE IF NOT EXISTS "user_subscriptions" (
  "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  "user_id" uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  "plan_type" text NOT NULL DEFAULT 'free',
  "token_balance" integer NOT NULL DEFAULT 100,
  "tokens_used" integer NOT NULL DEFAULT 0,
  "next_reset_date" timestamp with time zone,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create table for token transactions
CREATE TABLE IF NOT EXISTS "token_transactions" (
  "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  "user_id" uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  "amount" integer NOT NULL,
  "transaction_type" text NOT NULL,
  "description" text,
  "project_id" uuid REFERENCES "projects"(id) ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON "user_subscriptions"(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON "token_transactions"(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_project_id ON "token_transactions"(project_id);

-- Set up RLS (Row Level Security) for user_subscriptions
ALTER TABLE "user_subscriptions" ENABLE ROW LEVEL SECURITY;

-- Define policies for user_subscriptions
CREATE POLICY "Users can view own subscription" 
  ON "user_subscriptions" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON "user_subscriptions" FOR UPDATE
  USING (auth.uid() = user_id);

-- Set up RLS for token_transactions
ALTER TABLE "token_transactions" ENABLE ROW LEVEL SECURITY;

-- Define policies for token_transactions
CREATE POLICY "Users can view own token transactions"
  ON "token_transactions" FOR SELECT
  USING (auth.uid() = user_id);

-- Note: We don't need an INSERT policy for users since this should only be done
-- by the service role via Edge Functions or server-side code 
