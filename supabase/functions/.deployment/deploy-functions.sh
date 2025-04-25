#!/bin/bash

# This script deploys all Supabase Edge Functions in the project
# Make sure you have the Supabase CLI installed and logged in

# Exit on error
set -e

echo "Deploying Supabase Edge Functions..."

# Deploy the deduct-tokens function
echo "Deploying deduct-tokens function..."
supabase functions deploy deduct-tokens

# Deploy the reset-monthly-tokens function with scheduling
echo "Deploying reset-monthly-tokens function with scheduling..."
supabase functions deploy reset-monthly-tokens --no-verify-jwt

# Deploy any other functions as needed
# supabase functions deploy other-function-name

echo "All functions deployed successfully!"
echo "Note: Make sure to configure the scheduling for reset-monthly-tokens in the Supabase dashboard" 
