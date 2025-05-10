#!/bin/bash

# This script deploys Supabase Edge Functions with the required environment variables

# Check if .env file exists
if [ ! -f "./supabase/functions/create-checkout-session/.env" ]; then
    echo "Error: .env file not found in ./supabase/functions/create-checkout-session/"
    exit 1
fi

echo "Deploying create-checkout-session function..."

# Load environment variables from .env file
source ./supabase/functions/create-checkout-session/.env

# Deploy the function with environment variables using npx
npx supabase functions deploy create-checkout-session \
  --no-verify-jwt \
  --env-file ./supabase/functions/create-checkout-session/.env

echo "Deployment complete!"
echo "Testing function..."
echo "You can test with: curl -X POST https://jkdkgykaoyhpqoewlvpp.functions.supabase.co/create-checkout-session -H \"Content-Type: application/json\" -d '{\"priceId\":\"YOUR_PRICE_ID\",\"userId\":\"YOUR_USER_ID\",\"isSubscription\":false}'" 
