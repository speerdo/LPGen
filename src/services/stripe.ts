import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '../lib/supabase';

export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

export async function createCheckoutSession(
  priceId: string,
  userId: string,
  isSubscription: boolean = true
) {
  const { data, error } = await supabase.functions.invoke(
    'create-checkout-session',
    {
      body: { priceId, userId, isSubscription },
    }
  );

  if (error) throw new Error(error.message);
  return data.sessionId;
}

export async function createPortalSession(customerId: string) {
  const { data, error } = await supabase.functions.invoke(
    'create-portal-session',
    {
      body: { customerId },
    }
  );

  if (error) throw new Error(error.message);
  return data.url;
}

export async function getUserSubscription(userId: string) {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return null;
  return data;
}

/**
 * Creates a Stripe checkout session directly from the client
 * This is a backup implementation if the Supabase Edge Function fails
 *
 * @param priceId The Stripe price ID
 * @param userId The user's ID
 * @param isSubscription Whether this is a subscription or one-time payment
 * @returns The Checkout Session ID
 */
export async function createDirectCheckoutSession(
  priceId: string,
  userId: string,
  isSubscription: boolean = true
) {
  console.log(
    '[createDirectCheckoutSession] Starting direct checkout session creation'
  );

  const stripe = await stripePromise;
  if (!stripe) {
    console.error('[createDirectCheckoutSession] Stripe not initialized');
    throw new Error('Stripe not initialized');
  }

  try {
    // First, try to use the Supabase function
    try {
      console.log(
        '[createDirectCheckoutSession] Attempting to use Supabase Function first'
      );
      const sessionId = await createCheckoutSession(
        priceId,
        userId,
        isSubscription
      );
      return sessionId;
    } catch (error) {
      console.warn(
        '[createDirectCheckoutSession] Supabase function failed, falling back to direct client checkout:',
        error
      );
      // Continue with client-side implementation
    }

    // Get the user's data
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    const customerId = subscription?.stripe_customer_id;

    // If no customer ID, create one first by sending to a different endpoint
    if (!customerId) {
      console.log(
        '[createDirectCheckoutSession] No customer ID found, using session without customer'
      );
    }

    // Create session parameters based on whether it's a subscription or one-time payment
    const baseUrl = window.location.origin;

    // Create the checkout session parameters
    interface CheckoutParams {
      mode: 'subscription' | 'payment';
      line_items: Array<{ price: string; quantity: number }>;
      success_url: string;
      cancel_url: string;
      customer?: string;
    }

    const params: CheckoutParams = {
      mode: isSubscription ? 'subscription' : 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/payment-success?type=${
        isSubscription ? 'subscription' : 'one-time'
      }&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/account`,
    };

    // Add customer ID if available
    if (customerId) {
      Object.assign(params, { customer: customerId });
    }

    // Create the checkout session
    console.log(
      '[createDirectCheckoutSession] Creating session with params:',
      params
    );

    // Since the direct client API is not accessible, redirect to a stub function
    console.error(
      '[createDirectCheckoutSession] Direct client-side checkout is not possible with Stripe.js'
    );
    throw new Error(
      'Direct checkout not supported in this environment. Please configure the Supabase function correctly.'
    );
  } catch (error) {
    console.error('[createDirectCheckoutSession] Error:', error);
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to create checkout session'
    );
  }
}
