import { supabase } from './supabase';
import { PLANS } from '../services/tokens';

/**
 * Performs essential database setup checks for the token system
 * This should be called during application initialization
 */
export async function setupTokenSystem() {
  console.log('Setting up token system database checks...');

  try {
    // Check if user_subscriptions table exists
    const { error: subscriptionTableError } = await supabase
      .from('user_subscriptions')
      .select('id')
      .limit(1);

    if (subscriptionTableError) {
      console.warn(
        'user_subscriptions table may not exist:',
        subscriptionTableError.message
      );

      // If table doesn't exist, we should notify the user to run migrations
      if (subscriptionTableError.message.includes('does not exist')) {
        console.error(
          'IMPORTANT: user_subscriptions table does not exist! Run migrations first.'
        );

        // We just warn and don't throw to avoid breaking app functionality
      }
    }

    // Check if token_transactions table exists
    const { error: transactionsTableError } = await supabase
      .from('token_transactions')
      .select('id')
      .limit(1);

    if (transactionsTableError) {
      console.warn(
        'token_transactions table may not exist:',
        transactionsTableError.message
      );

      if (transactionsTableError.message.includes('does not exist')) {
        console.error(
          'IMPORTANT: token_transactions table does not exist! Run migrations first.'
        );
      }
    }

    // Check if the edge function for deducting tokens exists
    try {
      await supabase.functions.invoke('deduct-tokens', {
        body: { checkOnly: true },
      });
      console.log('deduct-tokens Edge Function is accessible');
    } catch (functionError) {
      console.warn(
        'deduct-tokens Edge Function check failed:',
        functionError instanceof Error
          ? functionError.message
          : String(functionError)
      );
      console.error(
        'IMPORTANT: deduct-tokens Edge Function may not be deployed!'
      );
    }

    console.log('Token system database checks completed');
    return { success: true };
  } catch (error) {
    console.error(
      'Error during token system setup:',
      error instanceof Error ? error.message : String(error)
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Creates a user subscription if it doesn't already exist
 * This is a helper for initializing new users
 */
export async function ensureUserSubscription(userId: string) {
  if (!userId) {
    console.error('Invalid user ID provided to ensureUserSubscription');
    return null;
  }

  try {
    // Check if user already has a subscription
    const { data: existingSubscription } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingSubscription) {
      console.log('User already has a subscription:', existingSubscription.id);
      return existingSubscription;
    }

    // Create next reset date (1st of next month)
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    // Create new subscription for the user
    const { data: newSubscription, error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_type: 'free',
        token_balance: PLANS.FREE.monthlyTokens,
        tokens_used: 0,
        next_reset_date: nextMonth.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating subscription:', error);
      return null;
    }

    console.log('Created new subscription for user:', newSubscription.id);
    return newSubscription;
  } catch (error) {
    console.error('Exception in ensureUserSubscription:', error);
    return null;
  }
}
