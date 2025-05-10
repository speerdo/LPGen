/**
 * create-checkout-session
 * 
 * This Supabase Edge Function creates a Stripe checkout session for subscription plans 
 * or one-time token purchases. The function validates the user, checks if they already 
 * have a Stripe customer ID, and returns a session ID that can be used with Stripe's 
 * checkout.js to redirect the user to the payment page.
 * 
 * Required environment variables:
 * - STRIPE_SECRET_KEY: Your Stripe secret key
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 * 
 * Parameters (in request body):
 * - priceId: Stripe price ID for the plan or token package
 * - userId: Supabase user ID 
 * - isSubscription: Boolean indicating if this is a subscription (default: true)
 */

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

// Environment variables - use process.env for Node.js environments (local dev)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const baseUrl = process.env.PUBLIC_URL || 'http://localhost:5173';

// Helper function to return error responses with CORS headers
function errorResponse(message: string, status = 500) {
  console.error(`Error: ${message}`);
  return new Response(
    JSON.stringify({ error: message }),
    { 
      status, 
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      } 
    }
  );
}

export const corsHandler = (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  return null;
};

export async function handler(req: Request) {
  // Handle CORS preflight
  const corsResult = corsHandler(req);
  if (corsResult) {
    return corsResult;
  }

  console.log('Processing checkout request');

  // Validate environment variables
  if (!stripeSecretKey) {
    return errorResponse('STRIPE_SECRET_KEY environment variable is not set');
  }
  
  if (!supabaseUrl) {
    return errorResponse('SUPABASE_URL environment variable is not set');
  }

  if (!supabaseServiceKey) {
    return errorResponse('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
  }
  
  try {
    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey);
    
    // Parse request body
    const { priceId, userId, isSubscription = true } = await req.json();
    
    console.log(`Checkout request for userId: ${userId}, priceId: ${priceId}, isSubscription: ${isSubscription}`);
    
    if (!priceId || !userId) {
      return errorResponse('Missing required parameters: priceId and userId are required', 400);
    }
    
    // Fetch the price from Stripe to make sure it exists
    try {
      const price = await stripe.prices.retrieve(priceId);
      if (!price) {
        return errorResponse('Invalid price ID', 400);
      }
    } catch (err) {
      return errorResponse(`Failed to validate price: ${err instanceof Error ? err.message : String(err)}`, 400);
    }
    
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if the user exists
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !user) {
      return errorResponse(`Invalid user ID: ${userError?.message || 'User not found'}`, 400);
    }
    
    // Get user's email for the checkout session
    const email = user.user.email;
    if (!email) {
      return errorResponse('User has no email address', 400);
    }
    
    // Check if the user already has a Stripe customer ID
    const { data: subscription, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (subscriptionError) {
      console.warn(`Error fetching subscription: ${subscriptionError.message}`);
    }
    
    let customerId = subscription?.stripe_customer_id;
    
    // Create a new customer if one doesn't exist
    if (!customerId) {
      console.log('Creating new Stripe customer for user');
      try {
        const customer = await stripe.customers.create({
          email,
          metadata: {
            user_id: userId
          }
        });
        
        customerId = customer.id;
        
        // Store the customer ID in the database for future use
        const { error: updateError } = await supabase
          .from('user_subscriptions')
          .upsert({ 
            user_id: userId,
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString()
          });
        
        if (updateError) {
          console.warn(`Failed to save customer ID: ${updateError.message}`);
        }
      } catch (err) {
        return errorResponse(`Failed to create Stripe customer: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    // Set the mode based on whether this is a subscription or one-time payment
    const mode = isSubscription ? 'subscription' : 'payment';
    
    // Create the checkout session
    console.log('Creating Stripe checkout session');
    try {
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
        success_url: `${baseUrl}/payment-success?type=${isSubscription ? 'subscription' : 'one-time'}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/account`,
        client_reference_id: userId,
      });
      
      // Return the session ID
      return new Response(
        JSON.stringify({ sessionId: session.id }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    } catch (err) {
      return errorResponse(`Failed to create checkout session: ${err instanceof Error ? err.message : String(err)}`);
    }
  } catch (error) {
    return errorResponse(`Unhandled error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
