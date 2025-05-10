-- Seed data for development environment

-- Insert a default subscription for the authenticated user if one doesn't exist
INSERT INTO user_subscriptions (user_id, plan_type, token_balance, tokens_used)
VALUES 
    ('51a0d461-9d7a-4a0f-b17e-5ca98ad57cd3', 'free', 100, 0)
ON CONFLICT (user_id) DO NOTHING; 
