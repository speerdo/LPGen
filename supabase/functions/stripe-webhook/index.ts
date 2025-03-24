/**
 * stripe-webhook
 * 
 * This Supabase Edge Function handles Stripe webhook events to manage user subscriptions
 * and token balances. It processes events such as checkout sessions, invoice payments,
 * and subscription cancellations. The function updates user subscription data in the
 * database and records token transactions for audit purposes.
 * 
 * Required environment variables:
 * - STRIPE_SECRET_KEY or VITE_STRIPE_SECRET_KEY: Your Stripe secret key
 * - STRIPE_WEBHOOK_SECRET or VITE_STRIPE_WEBHOOK_SECRET: Your Stripe webhook signing secret
 * - SUPABASE_URL or VITE_SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key (set in Supabase dashboard)
 * 
 * Handled webhook events:
 * - checkout.session.completed: When a user completes a subscription or one-time purchase
 * - invoice.payment_succeeded: When a recurring subscription payment succeeds
 * - customer.subscription.deleted: When a subscription is canceled
 */

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const PLANS = {
  PREMIUM: {
    stripePriceId: 'PREMIUM_PLAN_PRICE_ID',
    monthlyTokens: 1000,
  },
  FREE: {
    monthlyTokens: 100,
  },
};

const TOKEN_PACKS = {
  SMALL: {
    stripePriceId: 'SMALL_TOKEN_PACK_PRICE_ID',
    tokens: 100,
  },
  LARGE: {
    stripePriceId: 'LARGE_TOKEN_PACK_PRICE_ID',
    tokens: 500,
  }
};

// Check for required environment variables at startup
// Try both with and without VITE_ prefix
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.VITE_STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("ERROR: STRIPE_SECRET_KEY environment variable is not set");
}

const stripe = new Stripe(stripeSecretKey || 'dummy_key_for_init');

// Get Supabase URL and service key from environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
if (!supabaseUrl) {
  console.error("ERROR: SUPABASE_URL environment variable is not set");
}

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseServiceKey) {
  console.error("ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is not set");
}

const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');

// Function to record token transactions for audit purposes
async function recordTokenTransaction(userId: string, amount: number, type: string, description: string, projectId?: string) {
  await supabase.from('token_transactions').insert({
    user_id: userId,
    amount,
    transaction_type: type,
    description,
    project_id: projectId || null
  });
}

export async function handler(req: Request) {
  // Verify Stripe API key is available
  if (!stripeSecretKey) {
    return new Response(
      JSON.stringify({ error: 'Stripe API key not configured' }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        } 
      }
    );
  }
  
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  
  // Verify Supabase connection info is available
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Supabase connection information not configured' }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        } 
      }
    );
  }
  
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env.VITE_STRIPE_WEBHOOK_SECRET;
  
  if (!signature || !webhookSecret) {
    return new Response(
      JSON.stringify({ error: 'Missing signature or webhook secret' }),
      { 
        status: 400, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        } 
      }
    );
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id!;
        
        if (session.mode === 'subscription') {
          // Handle subscription payment
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const customerId = session.customer as string;
          
          // Get the price ID to determine the plan
          const priceId = subscription.items.data[0].price.id;
          
          // Update or create user subscription in database
          const { data: existingSubscription } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();
            
          const monthlyTokens = priceId === PLANS.PREMIUM.stripePriceId ? PLANS.PREMIUM.monthlyTokens : PLANS.FREE.monthlyTokens;
          const next_reset_date = new Date();
          next_reset_date.setMonth(next_reset_date.getMonth() + 1);
          
          if (existingSubscription) {
            await supabase
              .from('user_subscriptions')
              .update({
                plan_type: priceId === PLANS.PREMIUM.stripePriceId ? 'premium' : 'free',
                token_balance: monthlyTokens, // Set to monthly tokens (no accumulation)
                tokens_used: 0, // Reset usage counter
                next_reset_date: next_reset_date.toISOString(),
                stripe_customer_id: customerId,
                stripe_subscription_id: subscription.id,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId);
              
            // Record transaction
            await recordTokenTransaction(
              userId, 
              monthlyTokens, 
              'renewal', 
              `${monthlyTokens} tokens set from ${priceId === PLANS.PREMIUM.stripePriceId ? 'premium' : 'free'} plan subscription`
            );
          } else {
            await supabase
              .from('user_subscriptions')
              .insert({
                user_id: userId,
                plan_type: priceId === PLANS.PREMIUM.stripePriceId ? 'premium' : 'free',
                token_balance: monthlyTokens,
                tokens_used: 0,
                next_reset_date: next_reset_date.toISOString(),
                stripe_customer_id: customerId,
                stripe_subscription_id: subscription.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              
            // Record transaction
            await recordTokenTransaction(
              userId, 
              monthlyTokens, 
              'purchase', 
              `Initial ${monthlyTokens} tokens from ${priceId === PLANS.PREMIUM.stripePriceId ? 'premium' : 'free'} plan subscription`
            );
          }
        } else if (session.mode === 'payment') {
          // Handle one-time token purchase
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
          const priceId = lineItems.data[0].price?.id;
          
          let tokenAmount = 0;
          if (priceId === TOKEN_PACKS.SMALL.stripePriceId) {
            tokenAmount = TOKEN_PACKS.SMALL.tokens;
          } else if (priceId === TOKEN_PACKS.LARGE.stripePriceId) {
            tokenAmount = TOKEN_PACKS.LARGE.tokens;
          }
          
          // Update token balance
          const { data: subscription } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();
            
          if (subscription) {
            await supabase
              .from('user_subscriptions')
              .update({
                token_balance: subscription.token_balance + tokenAmount,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId);
              
            // Record transaction
            await recordTokenTransaction(
              userId, 
              tokenAmount, 
              'purchase', 
              `${tokenAmount} tokens purchased as one-time token pack`
            );
          } else {
            // Create a free subscription with additional tokens if the user doesn't have one
            const next_reset_date = new Date();
            next_reset_date.setMonth(next_reset_date.getMonth() + 1);
            
            await supabase
              .from('user_subscriptions')
              .insert({
                user_id: userId,
                plan_type: 'free',
                token_balance: tokenAmount,
                tokens_used: 0,
                next_reset_date: next_reset_date.toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              
            // Record transaction
            await recordTokenTransaction(
              userId, 
              tokenAmount, 
              'purchase', 
              `${tokenAmount} tokens purchased as first-time token pack`
            );
          }
        }
        break;
      }
      
      case 'invoice.payment_succeeded': {
        // Handle recurring subscription payments
        const invoice = event.data.object;
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const customerId = invoice.customer as string;
        
        // Find the user by customer ID
        const { data: userSubscription } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('stripe_customer_id', customerId)
          .single();
          
        if (userSubscription) {
          const priceId = subscription.items.data[0].price.id;
          const monthlyTokens = priceId === PLANS.PREMIUM.stripePriceId ? PLANS.PREMIUM.monthlyTokens : PLANS.FREE.monthlyTokens;
          const next_reset_date = new Date();
          next_reset_date.setMonth(next_reset_date.getMonth() + 1);
          
          await supabase
            .from('user_subscriptions')
            .update({
              token_balance: monthlyTokens, // Always set to monthly allowance (no rollovers)
              tokens_used: 0, // Reset tokens used
              next_reset_date: next_reset_date.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', userSubscription.id);
            
          // Record transaction
          await recordTokenTransaction(
            userSubscription.user_id, 
            monthlyTokens, 
            'renewal', 
            `Monthly renewal of ${monthlyTokens} tokens from ${priceId === PLANS.PREMIUM.stripePriceId ? 'premium' : 'free'} plan`
          );
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        // Handle subscription cancellation
        const subscription = event.data.object;
        
        const { data: userSubscription } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('stripe_subscription_id', subscription.id)
          .single();
          
        if (userSubscription) {
          await supabase
            .from('user_subscriptions')
            .update({
              plan_type: 'free',
              updated_at: new Date().toISOString(),
            })
            .eq('id', userSubscription.id);
            
          // Record transaction
          await recordTokenTransaction(
            userSubscription.user_id,
            0,
            'refund',
            'Subscription canceled and downgraded to free plan'
          );
        }
        break;
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        } 
      }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unknown error occurred' }),
      { 
        status: 400, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        } 
      }
    );
  }
} 
