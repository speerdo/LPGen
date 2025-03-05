import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const PLANS = {
  PREMIUM: {
    stripePriceId: 'price_1234567890',
    monthlyTokens: 1000,
  },
  FREE: {
    monthlyTokens: 100,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia'
});

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
  const signature = req.headers.get('stripe-signature')!;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  
  if (!signature || !webhookSecret) {
    return new Response('Missing signature', { status: 400 });
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
                token_balance: existingSubscription.token_balance + monthlyTokens,
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
              `${monthlyTokens} tokens added from ${priceId === PLANS.PREMIUM.stripePriceId ? 'premium' : 'free'} plan subscription`
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
          if (priceId === 'price_small_token_pack') {
            tokenAmount = 100;
          } else if (priceId === 'price_large_token_pack') {
            tokenAmount = 500;
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
              token_balance: monthlyTokens,
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

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unknown error occurred' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 
