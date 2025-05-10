# Supabase Edge Functions Deployment

This directory contains scripts and instructions for deploying the Supabase Edge Functions used in the LPGen application.

## Required Edge Functions

The LPGen application requires the following Edge Functions:

1. `deduct-tokens`: Securely deducts tokens from a user's account
2. `reset-monthly-tokens`: Scheduled function that resets user token balances monthly

## Deployment Process

### Prerequisites

- Supabase CLI installed
- Authenticated with Supabase via `supabase login`
- Proper environment variables set in Supabase

### Deploying Functions

1. Make the deployment script executable:

   ```
   chmod +x deploy-functions.sh
   ```

2. Run the deployment script:
   ```
   ./deploy-functions.sh
   ```

### Setting Up Scheduled Execution

After deploying the functions, you need to configure the `reset-monthly-tokens` function to run on a schedule:

1. Go to the Supabase Dashboard
2. Navigate to Edge Functions
3. Find the `reset-monthly-tokens` function
4. Configure it to run on a CRON schedule: `0 0 1 * *` (midnight on the 1st of every month)

## Environment Variables

Ensure these environment variables are set in the Supabase dashboard:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `STRIPE_SECRET_KEY`: Your Stripe secret key (if using Stripe)

## Troubleshooting

If you encounter issues with the token system:

1. Check function logs in the Supabase dashboard
2. Verify all environment variables are set correctly
3. Check the database tables (`user_subscriptions` and `token_transactions`) exist
4. Use the manual reset function `manuallyResetUserTokens` if needed
