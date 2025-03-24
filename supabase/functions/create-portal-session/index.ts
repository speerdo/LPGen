/**
 * create-portal-session
 * 
 * This Supabase Edge Function creates a Stripe customer portal session that allows
 * users to manage their subscription, payment methods, and billing history. The 
 * function takes a Stripe customer ID and returns a URL that redirects the user
 * to the Stripe Customer Portal.
 * 
 * Required environment variables:
 * - STRIPE_SECRET_KEY or VITE_STRIPE_SECRET_KEY: Your Stripe secret key
 * 
 * Parameters (in request body):
 * - customerId: Stripe customer ID
 */

import Stripe from 'stripe';

// Check for required environment variables at startup
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.VITE_STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("ERROR: STRIPE_SECRET_KEY environment variable is not set");
}

const stripe = new Stripe(stripeSecretKey || 'dummy_key_for_init');

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
    
    const { customerId } = await req.json();
    
    if (!customerId) {
      return new Response(
        JSON.stringify({ error: 'Missing customer ID' }),
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
    
    // Base URL for the app - default to localhost if not set
    const baseUrl = 'http://localhost:5173';
    
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/account`,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
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
    console.error('Error creating portal session:', error);
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
