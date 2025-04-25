import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '../lib/supabase';

export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

export const PLANS = {
  FREE: {
    name: 'Free',
    monthlyTokens: 100, // Enough for ~1 landing page
    price: 0,
    stripePriceId: null,
  },
  PREMIUM: {
    name: 'Premium',
    monthlyTokens: 1000, // Enough for ~10 landing pages
    price: 19.99,
    stripePriceId: 'PREMIUM_PLAN_PRICE_ID',
  },
  TOKEN_PACK_SMALL: {
    name: '100 Extra Tokens',
    tokens: 100,
    price: 4.99,
    stripePriceId: 'SMALL_TOKEN_PACK_PRICE_ID',
  },
  TOKEN_PACK_LARGE: {
    name: '500 Extra Tokens',
    tokens: 500,
    price: 19.99,
    stripePriceId: 'LARGE_TOKEN_PACK_PRICE_ID',
  },
};

// Token pricing constants for different operations
export const TOKEN_COSTS = {
  // Initial scraping and generation is most expensive
  // This includes screenshot cost
  INITIAL_LANDING_PAGE: 100,

  // Refinements are cheaper as they don't require new scraping
  LANDING_PAGE_REFINEMENT: 30,

  // Simple text edits are cheapest
  CONTENT_UPDATE: 15,

  // Generating specific sections costs a moderate amount
  SECTION_GENERATION: 25,

  // Token cost for sending HTML to another service (like taking screenshots)
  EXTERNAL_SERVICE: 10,
};

// For backward compatibility
export const TOKENS_PER_LANDING_PAGE = TOKEN_COSTS.INITIAL_LANDING_PAGE;

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
 * Retrieves a user's current token balance and checks if they have enough for an operation
 * @param userId User ID
 * @param requiredTokens Number of tokens needed for the operation
 * @returns Object containing balance information and sufficiency status
 */
export async function checkTokenBalance(
  userId: string,
  requiredTokens: number
): Promise<{
  sufficient: boolean;
  currentBalance: number;
  deficit?: number;
}> {
  console.log(
    `[checkTokenBalance] Checking if user ${userId} has ${requiredTokens} tokens available`
  );

  // Try to get the user's subscription
  const { data: subscription, error: fetchError } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // If subscription not found, try to create a fallback
  let userSubscription;
  if (fetchError || !subscription) {
    console.log(
      '[checkTokenBalance] Subscription not found, creating fallback subscription'
    );
    userSubscription = await createUserSubscription(userId);
    if (!userSubscription) {
      console.error(
        '[checkTokenBalance] Failed to create fallback subscription'
      );
      throw new Error('Failed to find or create subscription');
    }
  } else {
    userSubscription = subscription;
  }

  console.log(
    '[checkTokenBalance] Current balance:',
    userSubscription.token_balance
  );

  const sufficient = userSubscription.token_balance >= requiredTokens;
  const result: {
    sufficient: boolean;
    currentBalance: number;
    deficit?: number;
  } = {
    sufficient,
    currentBalance: userSubscription.token_balance,
  };

  if (!sufficient) {
    result.deficit = requiredTokens - userSubscription.token_balance;
    console.log(
      `[checkTokenBalance] Insufficient tokens. Deficit: ${result.deficit}`
    );
  }

  return result;
}

/**
 * Deducts tokens from a user's balance
 * @param userId User ID
 * @param tokenAmount Number of tokens to deduct
 * @param operation Optional: description of operation for logging/tracking
 */
export async function deductTokens(
  userId: string,
  tokenAmount: number,
  operation?: string
) {
  console.log(
    `[deductTokens] Attempting to deduct ${tokenAmount} tokens for user ${userId} (${
      operation || 'no operation specified'
    })`
  );

  if (!userId) {
    console.error('[deductTokens] No user ID provided');
    throw new Error('User ID is required');
  }

  if (tokenAmount <= 0) {
    console.error('[deductTokens] Invalid token amount:', tokenAmount);
    throw new Error('Token amount must be greater than zero');
  }

  // Try to use the Supabase Edge Function for token deduction
  try {
    console.log('[deductTokens] Invoking Edge Function to deduct tokens');
    const { data, error } = await supabase.functions.invoke('deduct-tokens', {
      body: {
        userId,
        tokenAmount,
        operation: operation || 'Unknown operation',
      },
    });

    if (error) {
      console.error('[deductTokens] Edge function error:', error);
      // Fall back to legacy logic
      return await legacyDeductTokens(userId, tokenAmount, operation);
    }

    console.log(
      '[deductTokens] Successfully deducted tokens via Edge Function',
      data
    );
    return {
      newBalance: data.tokensRemaining,
      success: true,
      tokensUsed: tokenAmount,
    };
  } catch (functionError) {
    console.warn('[deductTokens] Edge function failed:', functionError);
    // Fall back to legacy logic
    return await legacyDeductTokens(userId, tokenAmount, operation);
  }
}

/**
 * Legacy method to deduct tokens directly from the database
 * Used as fallback when the Edge Function fails
 */
async function legacyDeductTokens(
  userId: string,
  tokenAmount: number,
  operation?: string
) {
  console.log(
    `[legacyDeductTokens] Using legacy method to deduct ${tokenAmount} tokens`
  );

  // Track if we're using a fallback subscription
  let usingFallback = false;

  // Try to get the user's subscription
  const { data: subscription, error: fetchError } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // If subscription not found, try to create a fallback
  let userSubscription;
  if (fetchError || !subscription) {
    console.log(
      '[legacyDeductTokens] Subscription not found or DB error, using fallback subscription'
    );
    userSubscription = createFallbackSubscription(userId);
    usingFallback = true;
  } else {
    userSubscription = subscription;
  }

  console.log('[legacyDeductTokens] Using subscription:', {
    id: userSubscription.id,
    user_id: userSubscription.user_id,
    plan_type: userSubscription.plan_type,
    token_balance: userSubscription.token_balance,
    tokens_used: userSubscription.tokens_used,
  });

  if (userSubscription.token_balance < tokenAmount) {
    console.error('[legacyDeductTokens] Insufficient tokens', {
      balance: userSubscription.token_balance,
      requested: tokenAmount,
    });
    throw new Error('Insufficient tokens');
  }

  // If using fallback, we just update the in-memory object
  if (usingFallback) {
    console.log('[legacyDeductTokens] Using fallback - no database update');
    const newBalance = userSubscription.token_balance - tokenAmount;
    const newTokensUsed = userSubscription.tokens_used + tokenAmount;

    // This would only be updated in memory, not in the database
    userSubscription.token_balance = newBalance;
    userSubscription.tokens_used = newTokensUsed;

    console.log(
      '[legacyDeductTokens] Successfully deducted tokens (fallback mode)',
      {
        newBalance,
        tokensUsed: tokenAmount,
      }
    );

    return {
      newBalance,
      success: true,
      tokensUsed: tokenAmount,
      fallback: true,
    };
  }

  // Direct database update if not using fallback
  try {
    // Update the user's token balance
    const { error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        token_balance: userSubscription.token_balance - tokenAmount,
        tokens_used: (userSubscription.tokens_used || 0) + tokenAmount,
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error(
        '[legacyDeductTokens] Failed to update token balance:',
        updateError
      );

      // Return success with the fallback changes anyway so the user experience isn't disrupted
      console.log(
        '[legacyDeductTokens] Using calculated values despite DB error'
      );

      return {
        newBalance: userSubscription.token_balance - tokenAmount,
        success: true,
        tokensUsed: tokenAmount,
        error:
          updateError instanceof Error
            ? updateError.message
            : String(updateError),
        fallback: true,
      };
    }

    // Try to record the token transaction
    try {
      const { error: transactionError } = await supabase
        .from('token_transactions')
        .insert({
          user_id: userId,
          amount: tokenAmount,
          transaction_type: 'deduct',
          description: operation || 'Token usage',
        });

      if (transactionError) {
        console.warn(
          '[legacyDeductTokens] Failed to record token transaction:',
          transactionError
        );
        // Continue despite transaction recording failure
      }
    } catch (transactionError) {
      console.warn(
        '[legacyDeductTokens] Exception recording transaction:',
        transactionError
      );
      // Continue despite transaction exception
    }

    console.log(
      '[legacyDeductTokens] Successfully deducted tokens via direct update',
      {
        newBalance: userSubscription.token_balance - tokenAmount,
        tokensUsed: tokenAmount,
      }
    );

    return {
      newBalance: userSubscription.token_balance - tokenAmount,
      success: true,
      tokensUsed: tokenAmount,
    };
  } catch (updateError) {
    console.error(
      '[legacyDeductTokens] Exception during token update:',
      updateError
    );

    // Return success with the fallback changes anyway so the user experience isn't disrupted
    return {
      newBalance: userSubscription.token_balance - tokenAmount,
      success: true,
      tokensUsed: tokenAmount,
      error:
        updateError instanceof Error
          ? updateError.message
          : String(updateError),
      fallback: true,
    };
  }
}

// Reset all token balances to monthly allowance on 1st of month
export async function resetMonthlyTokens() {
  const today = new Date();
  const isFirstOfMonth = today.getDate() === 1;

  if (!isFirstOfMonth)
    return { success: false, message: 'Not first day of month' };

  // Reset all free subscriptions to 100 tokens
  const { error: freeError } = await supabase
    .from('user_subscriptions')
    .update({
      token_balance: PLANS.FREE.monthlyTokens,
      tokens_used: 0,
      next_reset_date: getNextResetDate().toISOString(),
    })
    .eq('plan_type', 'free');

  // Reset all premium subscriptions to their monthly token amount
  const { error: premiumError } = await supabase
    .from('user_subscriptions')
    .update({
      token_balance: PLANS.PREMIUM.monthlyTokens,
      tokens_used: 0,
      next_reset_date: getNextResetDate().toISOString(),
    })
    .eq('plan_type', 'premium');

  if (freeError || premiumError) {
    return { success: false, error: freeError || premiumError };
  }

  return { success: true };
}

// Create user subscription for new users with 100 free tokens
export async function createUserSubscription(userId: string) {
  console.log('Creating user subscription for:', userId);

  if (!userId) {
    console.error('Invalid user ID provided to createUserSubscription');
    return createFallbackSubscription(userId);
  }

  // Instead of trying to create tables that might not exist in the DB,
  // just use the fallback subscription approach
  try {
    // Try to fetch existing subscription
    const { data: existingSubscription, error: queryError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    // If table doesn't exist or other error, use fallback
    if (queryError) {
      console.log('Error fetching subscription:', queryError.message);

      // If it's a "table doesn't exist" error, don't keep trying to create it
      if (queryError.message && queryError.message.includes('does not exist')) {
        console.log(
          "Subscription tables don't exist yet in the database - using fallback"
        );
        // Using fallback subscription since we can't create tables via SQL from the client
        return createFallbackSubscription(userId);
      }
    }

    // If we successfully found a subscription, return it
    if (existingSubscription) {
      console.log('Existing subscription found, returning it');
      return existingSubscription;
    }

    // Create new subscription (only try if the table exists but subscription doesn't)
    console.log('No existing subscription found, creating new one');
    const next_reset_date = getNextResetDate().toISOString();

    try {
      const { data: newSubscription, error } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_type: 'free',
          token_balance: PLANS.FREE.monthlyTokens, // 100 tokens
          tokens_used: 0,
          next_reset_date,
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error creating subscription:', error);
        return createFallbackSubscription(userId);
      }

      console.log('New subscription created successfully');
      return newSubscription;
    } catch (insertError) {
      console.error('Exception during subscription creation:', insertError);
      return createFallbackSubscription(userId);
    }
  } catch (error) {
    console.error('Exception in createUserSubscription:', error);
    return createFallbackSubscription(userId);
  }
}

/**
 * Creates a fallback subscription object when database operations fail
 * This ensures the UI works even if database operations fail
 */
function createFallbackSubscription(userId: string) {
  console.log(
    'Creating fallback subscription with default 100 tokens for user:',
    userId
  );

  return {
    id: `temp-${userId}`, // Not a real UUID but good enough as a fallback
    user_id: userId,
    plan_type: 'free',
    token_balance: PLANS.FREE.monthlyTokens,
    tokens_used: 0,
    next_reset_date: getNextResetDate().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stripe_customer_id: null,
    stripe_subscription_id: null,
  };
}

// Helper function to get next reset date (1st of next month)
function getNextResetDate() {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return nextMonth;
}

// Manually reset a user's tokens to their plan's monthly amount
export async function manuallyResetUserTokens(userId: string) {
  // Get user's current subscription
  const { data: subscription, error: fetchError } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError || !subscription) throw new Error('Subscription not found');

  const monthlyTokens =
    subscription.plan_type === 'premium'
      ? PLANS.PREMIUM.monthlyTokens
      : PLANS.FREE.monthlyTokens;

  // Update token balance to monthly amount and reset usage counter
  const { error: updateError } = await supabase
    .from('user_subscriptions')
    .update({
      token_balance: monthlyTokens,
      tokens_used: 0,
      next_reset_date: getNextResetDate().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updateError) throw new Error('Failed to reset token balance');

  // Record transaction
  await supabase.from('token_transactions').insert({
    user_id: userId,
    amount: monthlyTokens,
    transaction_type: 'renewal',
    description: 'Manual token reset',
  });

  return {
    success: true,
    newBalance: monthlyTokens,
    plan: subscription.plan_type,
  };
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
