#!/bin/bash

# Deploy all Supabase Edge Functions
echo "Deploying Supabase Edge Functions..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Supabase CLI is not installed. Please install it first."
    echo "https://supabase.com/docs/guides/cli/getting-started"
    exit 1
fi

# Navigate to the project root
cd "$(dirname "$0")"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Warning: .env file not found. Make sure environment variables are set properly."
fi

# Ensure required environment variables are set for the function
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not set."
    echo "These will need to be set in the Supabase dashboard for the function to work properly."
fi

# Deploy the functions
echo "Deploying deduct-tokens function..."
supabase functions deploy deduct-tokens --no-verify-jwt

echo "Setting environment variables for functions..."
supabase secrets set SUPABASE_URL=${SUPABASE_URL:-""}
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-""}

# If you have other functions, add them here
# echo "Deploying another-function..."
# supabase functions deploy another-function

echo "Function deployment completed successfully!" 
