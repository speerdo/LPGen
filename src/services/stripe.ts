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

export const TOKENS_PER_LANDING_PAGE = 100;

export async function createCheckoutSession(priceId: string, userId: string, isSubscription: boolean = true) {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { priceId, userId, isSubscription },
  });
  
  if (error) throw new Error(error.message);
  return data.sessionId;
}

export async function createPortalSession(customerId: string) {
  const { data, error } = await supabase.functions.invoke('create-portal-session', {
    body: { customerId },
  });
  
  if (error) throw new Error(error.message);
  return data.url;
}

export async function getUserSubscription(userId: string) {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  if (error) return null;
  return data;
}

export async function deductTokens(userId: string, tokenAmount: number) {
  const { data: subscription, error: fetchError } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  if (fetchError || !subscription) throw new Error('Subscription not found');
  
  if (subscription.token_balance < tokenAmount) {
    throw new Error('Insufficient tokens');
  }
  
  const { error: updateError } = await supabase
    .from('user_subscriptions')
    .update({ 
      token_balance: subscription.token_balance - tokenAmount,
      tokens_used: subscription.tokens_used + tokenAmount
    })
    .eq('user_id', userId);
    
  if (updateError) throw new Error('Failed to update token balance');
  
  return {
    newBalance: subscription.token_balance - tokenAmount,
    success: true
  };
}

// Reset all token balances to monthly allowance on 1st of month
export async function resetMonthlyTokens() {
  const today = new Date();
  const isFirstOfMonth = today.getDate() === 1;
  
  if (!isFirstOfMonth) return { success: false, message: 'Not first day of month' };
  
  // Reset all free subscriptions to 100 tokens
  const { error: freeError } = await supabase
    .from('user_subscriptions')
    .update({ 
      token_balance: PLANS.FREE.monthlyTokens,
      tokens_used: 0,
      next_reset_date: getNextResetDate().toISOString()
    })
    .eq('plan_type', 'free');
    
  // Reset all premium subscriptions to their monthly token amount
  const { error: premiumError } = await supabase
    .from('user_subscriptions')
    .update({ 
      token_balance: PLANS.PREMIUM.monthlyTokens,
      tokens_used: 0,
      next_reset_date: getNextResetDate().toISOString()
    })
    .eq('plan_type', 'premium');
    
  if (freeError || premiumError) {
    return { success: false, error: freeError || premiumError };
  }
  
  return { success: true };
}

// Create user subscription for new users with 100 free tokens
export async function createUserSubscription(userId: string) {
  console.log("Creating user subscription for:", userId);
  
  if (!userId) {
    console.error("Invalid user ID provided to createUserSubscription");
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
      .single();
    
    // If table doesn't exist or other error, use fallback
    if (queryError) {
      console.log("Error fetching subscription:", queryError.message);
      
      // If it's a "table doesn't exist" error, don't keep trying to create it
      if (queryError.message && queryError.message.includes('does not exist')) {
        console.log("Subscription tables don't exist yet in the database - using fallback");
        // Using fallback subscription since we can't create tables via SQL from the client
        return createFallbackSubscription(userId);
      }
    }
    
    // If we successfully found a subscription, return it
    if (existingSubscription) {
      console.log("Existing subscription found, returning it");
      return existingSubscription;
    }
    
    // Create new subscription (only try if the table exists but subscription doesn't)
    console.log("No existing subscription found, creating new one");
    const next_reset_date = getNextResetDate().toISOString();
    
    try {
      const { data: newSubscription, error } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_type: 'free',
          token_balance: PLANS.FREE.monthlyTokens, // 100 tokens
          tokens_used: 0,
          next_reset_date
        })
        .select()
        .single();
        
      if (error) {
        console.error("Error creating subscription:", error);
        return createFallbackSubscription(userId);
      }
      
      console.log("New subscription created successfully");
      return newSubscription;
    } catch (insertError) {
      console.error("Exception during subscription creation:", insertError);
      return createFallbackSubscription(userId);
    }
  } catch (error) {
    console.error("Exception in createUserSubscription:", error);
    return createFallbackSubscription(userId);
  }
}

/**
 * Creates a fallback subscription object when database operations fail
 * This ensures the UI works even if database operations fail
 */
function createFallbackSubscription(userId: string) {
  console.log("Creating fallback subscription with default 100 tokens for user:", userId);
  
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
    stripe_subscription_id: null
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
    .single();
    
  if (fetchError || !subscription) throw new Error('Subscription not found');
  
  const monthlyTokens = subscription.plan_type === 'premium' 
    ? PLANS.PREMIUM.monthlyTokens 
    : PLANS.FREE.monthlyTokens;
  
  // Update token balance to monthly amount and reset usage counter
  const { error: updateError } = await supabase
    .from('user_subscriptions')
    .update({ 
      token_balance: monthlyTokens,
      tokens_used: 0,
      next_reset_date: getNextResetDate().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);
    
  if (updateError) throw new Error('Failed to reset token balance');
  
  // Record transaction
  await supabase.from('token_transactions').insert({
    user_id: userId,
    amount: monthlyTokens,
    transaction_type: 'renewal',
    description: 'Manual token reset'
  });
  
  return {
    success: true,
    newBalance: monthlyTokens,
    plan: subscription.plan_type
  };
}
