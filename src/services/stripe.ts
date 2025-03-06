import { loadStripe } from '@stripe/stripe-js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
    stripePriceId: 'price_1234567890',
  },
  TOKEN_PACK_SMALL: {
    name: '100 Extra Tokens',
    tokens: 100,
    price: 4.99,
    stripePriceId: 'price_small_token_pack',
  },
  TOKEN_PACK_LARGE: {
    name: '500 Extra Tokens',
    tokens: 500,
    price: 19.99,
    stripePriceId: 'price_large_token_pack',
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
