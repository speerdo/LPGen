/**
 * create-checkout-session
 * 
 * This Supabase Edge Function creates a Stripe checkout session for subscription plans 
 * or one-time token purchases. The function validates the user, checks if they already 
 * have a Stripe customer ID, and returns a session ID that can be used with Stripe's 
 * checkout.js to redirect the user to the payment page.
 * 
 * Required environment variables:
 * - STRIPE_SECRET_KEY or VITE_STRIPE_SECRET_KEY: Your Stripe secret key
 * - SUPABASE_URL or VITE_SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key (set in Supabase dashboard)
 * 
 * Parameters (in request body):
 * - priceId: Stripe price ID for the plan or token package
 * - userId: Supabase user ID 
 * - isSubscription: Boolean indicating if this is a subscription (default: true)
 */

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Check for required environment variables at startup
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.VITE_STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("ERROR: STRIPE_SECRET_KEY environment variable is not set");
}

const stripe = new Stripe(stripeSecretKey || 'dummy_key_for_init');

// Base URL for the app - default to localhost if not set
const baseUrl = process.env.PUBLIC_URL || 'http://localhost:5173';

export async function handler(req: Request) {
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

  try {
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
    
    const { priceId, userId, isSubscription = true } = await req.json();
    
    if (!priceId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
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
    
    // Fetch the price from Stripe to make sure it exists
    const price = await stripe.prices.retrieve(priceId);
    
    if (!price) {
      return new Response(
        JSON.stringify({ error: 'Invalid price ID' }),
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
    
    // Get Supabase URL from environment variables
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      return new Response(
        JSON.stringify({ error: 'Supabase URL not configured' }),
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
    
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase service role key not configured' }),
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
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if the user exists
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get user's email for the checkout session
    const email = user.user.email;
    
    // Check if the user already has a Stripe customer ID
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();
    
    let customerId = subscription?.stripe_customer_id;
    
    // Create a new customer if one doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          user_id: userId
        }
      });
      
      customerId = customer.id;
    }
    
    // Set the mode based on whether this is a subscription or one-time payment
    const mode = isSubscription ? 'subscription' : 'payment';
    
    // Create the checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode,
      success_url: `${baseUrl}/payment-success`,
      cancel_url: `${baseUrl}/account`,
      client_reference_id: userId,
    });
    
    return new Response(
      JSON.stringify({ sessionId: session.id }),
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
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unknown error occurred' }),
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
}
