# Supabase Edge Functions for Stripe Integration

This directory contains Supabase Edge Functions used for Stripe integration in the LandingAI application.

## Functions

- `create-checkout-session`: Creates a Stripe checkout session for subscriptions and one-time purchases
- `create-portal-session`: Creates a Stripe customer portal session for managing subscriptions
- `stripe-webhook`: Handles Stripe webhook events for payment processing and subscription management
- `reset-monthly-tokens`: Resets user token balances on a monthly basis

## Deployment

1. Install the Supabase CLI:
   ```
   npm install -g supabase
   ```

2. Log in to your Supabase account:
   ```
   supabase login
   ```

3. Set up your project:
   ```
   supabase link --project-ref jkdkgykaoyhpqoewlvpp
   ```

4. Configure environment variables in each function's `.env` file. For example in `create-checkout-session/.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
   SUPABASE_URL=https://jkdkgykaoyhpqoewlvpp.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   PUBLIC_URL=http://localhost:5173
   ```

5. Deploy each function using the provided script:
   ```
   ./deploy-functions.sh
   ```

## Troubleshooting

### CORS Issues

If you're experiencing CORS issues:

1. Make sure all Edge Functions have proper CORS headers:
   ```typescript
   const corsHeaders = {
     'Access-Control-Allow-Origin': '*',
     'Access-Control-Allow-Methods': 'POST, OPTIONS',
     'Access-Control-Allow-Headers': 'Content-Type, Authorization',
     'Access-Control-Max-Age': '86400'
   };
   ```

2. Ensure the function properly handles OPTIONS requests with a handler like:
   ```typescript
   export const corsHandler = (req: Request) => {
     if (req.method === 'OPTIONS') {
       return new Response(null, {
         status: 204,
         headers: corsHeaders
       });
     }
     return null;
   };
   ```

3. Include the CORS headers in all response objects:
   ```typescript
   return new Response(
     JSON.stringify({ data }),
     { 
       headers: { 
         'Content-Type': 'application/json',
         ...corsHeaders
       } 
     }
   );
   ```

### Environment Variables

If environment variables are not being set correctly:

1. Make sure you're using the `--env-file` flag when deploying:
   ```
   supabase functions deploy function-name --env-file ./path/to/.env
   ```

2. Check that the environment variables are being accessed correctly in your code:
   ```typescript
   const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
   ```

3. Verify your environment variables in the Supabase dashboard under "Functions" > [function name] > "Settings".

## Testing

You can test each function using curl or Postman:

```
curl -X POST https://jkdkgykaoyhpqoewlvpp.functions.supabase.co/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{"priceId":"YOUR_PRICE_ID","userId":"YOUR_USER_ID","isSubscription":false}'
``` 
