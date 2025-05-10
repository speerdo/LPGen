import { supabase } from '../lib/supabase';

// Define subscription plans here instead of importing from stripe
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

  // Ensure we have a valid number for token amount (edge case handling)
  const tokensToDeduct = Math.floor(tokenAmount);

  // Try to use the Supabase Edge Function for token deduction
  try {
    console.log('[deductTokens] Invoking Edge Function to deduct tokens');

    // Try to extract project ID from operation if it's in the format "operation_name project_id:xyz"
    let projectId = null;
    if (operation && operation.includes('project_id:')) {
      try {
        projectId = operation.split('project_id:')[1].trim().split(' ')[0];
        console.log(`[deductTokens] Extracted project ID: ${projectId}`);
      } catch (extractError) {
        console.warn(
          '[deductTokens] Failed to extract project ID:',
          extractError
        );
      }
    }

    const { data, error } = await supabase.functions.invoke('deduct-tokens', {
      body: {
        userId,
        tokenAmount: tokensToDeduct,
        operation: operation || 'Unknown operation',
        projectId,
      },
    });

    if (error) {
      console.error('[deductTokens] Edge function error:', error);
      // Fall back to legacy logic
      const result = await legacyDeductTokens(
        userId,
        tokensToDeduct,
        operation
      );

      // Try to refresh the UI immediately after deduction
      tryRefreshUserSubscription(userId, result.newBalance);

      return result;
    }

    console.log(
      '[deductTokens] Successfully deducted tokens via Edge Function',
      data
    );

    // Try to refresh the UI immediately after deduction
    tryRefreshUserSubscription(userId, data.tokensRemaining);

    return {
      newBalance: data.tokensRemaining,
      success: true,
      tokensUsed: tokensToDeduct,
    };
  } catch (functionError) {
    console.warn('[deductTokens] Edge function failed:', functionError);
    // Fall back to legacy logic
    const result = await legacyDeductTokens(userId, tokensToDeduct, operation);

    // Try to refresh the UI immediately after deduction
    tryRefreshUserSubscription(userId, result.newBalance);

    return result;
  }
}

/**
 * Helper function to trigger subscription refresh in the AuthContext
 * This helps ensure the UI updates immediately after token deduction
 */
async function tryRefreshUserSubscription(userId: string, newBalance: number) {
  try {
    console.log(
      `[tryRefreshUserSubscription] Updating balance to ${newBalance} for user ${userId}`
    );

    // First, update the user_subscriptions table directly
    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        token_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.warn('[tryRefreshUserSubscription] Failed to update DB:', error);

      // Try a second time with a simple query
      try {
        await supabase.rpc('update_token_balance', {
          user_id: userId,
          new_balance: newBalance,
        });
        console.log('[tryRefreshUserSubscription] RPC update succeeded');
      } catch {
        // Ignore RPC errors - this is just a fallback attempt
        console.warn('[tryRefreshUserSubscription] RPC update failed');
      }
    } else {
      console.log('[tryRefreshUserSubscription] Database updated successfully');
    }

    // Try to refresh the auth context subscription data
    // This will use the updated values from the database
    interface WindowWithRefresh extends Window {
      __refreshUserSubscription?: () => void;
    }
    const refreshFn = (window as WindowWithRefresh).__refreshUserSubscription;

    if (typeof refreshFn === 'function') {
      console.log('[tryRefreshUserSubscription] Triggering UI refresh');
      setTimeout(() => {
        try {
          refreshFn();
        } catch (refreshError) {
          console.warn(
            '[tryRefreshUserSubscription] Error during refresh:',
            refreshError
          );
        }
      }, 100); // Short delay to allow DB update to propagate
    } else {
      console.warn(
        '[tryRefreshUserSubscription] No refresh function available'
      );
    }
  } catch (error) {
    console.warn('[tryRefreshUserSubscription] Error refreshing UI:', error);
    // Don't throw - this is just a UI improvement
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
      '[legacyDeductTokens] Subscription not found or DB error, creating new subscription'
    );

    // Instead of creating a fallback, try to create a real subscription record
    try {
      const next_reset_date = getNextResetDate().toISOString();
      const { data: newSubscription, error: createError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_type: 'free',
          token_balance: PLANS.FREE.monthlyTokens,
          tokens_used: 0,
          next_reset_date,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError || !newSubscription) {
        console.error(
          '[legacyDeductTokens] Failed to create new subscription:',
          createError
        );
        userSubscription = createFallbackSubscription(userId);
        usingFallback = true;
      } else {
        console.log(
          '[legacyDeductTokens] Created new subscription:',
          newSubscription.id
        );
        userSubscription = newSubscription;
      }
    } catch (createError) {
      console.error(
        '[legacyDeductTokens] Exception creating subscription:',
        createError
      );
      userSubscription = createFallbackSubscription(userId);
      usingFallback = true;
    }
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

  // Calculate new token balance
  const newBalance = userSubscription.token_balance - tokenAmount;
  const newTokensUsed = (userSubscription.tokens_used || 0) + tokenAmount;

  // If using fallback and we couldn't create a DB record earlier,
  // make one final attempt to create or update the DB record
  if (usingFallback) {
    console.log(
      '[legacyDeductTokens] Using fallback but attempting database update'
    );

    try {
      // Check if the subscription exists now (maybe it was created in the meantime)
      const { data: existingSub } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingSub) {
        // If it exists now, update it
        const { error: updateError } = await supabase
          .from('user_subscriptions')
          .update({
            token_balance: newBalance,
            tokens_used: newTokensUsed,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (!updateError) {
          console.log(
            '[legacyDeductTokens] Successfully updated existing subscription'
          );
          usingFallback = false;
        }
      } else {
        // Try to create again
        const next_reset_date = getNextResetDate().toISOString();
        const { error: insertError } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: userId,
            plan_type: 'free',
            token_balance: newBalance,
            tokens_used: newTokensUsed,
            next_reset_date,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (!insertError) {
          console.log(
            '[legacyDeductTokens] Successfully created new subscription record'
          );
          usingFallback = false;
        }
      }
    } catch (dbError) {
      console.warn(
        '[legacyDeductTokens] Failed to persist fallback changes:',
        dbError
      );
      // Continue with fallback mode
    }
  }

  // If still using fallback, we just keep the in-memory object
  if (usingFallback) {
    console.log('[legacyDeductTokens] Using fallback - in-memory update only');

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
        token_balance: newBalance,
        tokens_used: newTokensUsed,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error(
        '[legacyDeductTokens] Failed to update token balance:',
        updateError
      );

      // One more attempt with a retried update
      try {
        const { error: retryError } = await supabase
          .from('user_subscriptions')
          .update({
            token_balance: newBalance,
            tokens_used: newTokensUsed,
          })
          .eq('user_id', userId);

        if (!retryError) {
          console.log('[legacyDeductTokens] Retry update succeeded');
        }
      } catch (retryError) {
        console.warn(
          '[legacyDeductTokens] Retry update also failed:',
          retryError
        );
      }

      // Return success with the changes anyway so the user experience isn't disrupted
      console.log(
        '[legacyDeductTokens] Using calculated values despite DB error'
      );

      return {
        newBalance,
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
          created_at: new Date().toISOString(),
          // Extract project_id from operation string if it contains it
          project_id:
            operation && operation.includes('project_id:')
              ? operation.split('project_id:')[1].trim().split(' ')[0]
              : null,
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
        newBalance,
        tokensUsed: tokenAmount,
      }
    );

    return {
      newBalance,
      success: true,
      tokensUsed: tokenAmount,
    };
  } catch (updateError) {
    console.error(
      '[legacyDeductTokens] Exception during token update:',
      updateError
    );

    // Return success with the calculated changes anyway so the user experience isn't disrupted
    return {
      newBalance,
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
 * Get detailed token balance information via Edge Function
 * @param userId User ID to check balance for
 * @returns Detailed token information including recent transactions
 */
export async function getDetailedTokenBalance(userId: string) {
  if (!userId) {
    console.error('[getDetailedTokenBalance] No user ID provided');
    throw new Error('User ID is required');
  }

  try {
    console.log(
      '[getDetailedTokenBalance] Fetching detailed token info for',
      userId
    );
    const { data, error } = await supabase.functions.invoke(
      'get-token-balance',
      {
        body: {
          userId,
        },
      }
    );

    if (error) {
      console.error('[getDetailedTokenBalance] Edge function error:', error);
      throw new Error(`Failed to get token balance: ${error.message}`);
    }

    return data;
  } catch (functionError) {
    console.warn('[getDetailedTokenBalance] Function failed:', functionError);
    throw functionError;
  }
}

/**
 * Manually reset a user's tokens for debugging and support purposes
 * @param userId User ID to reset tokens for
 * @param tokenAmount Amount to reset to (defaults to 500)
 */
export async function debugResetTokens(userId: string, tokenAmount = 500) {
  if (!userId) {
    console.error('[debugResetTokens] No user ID provided');
    throw new Error('User ID is required');
  }

  try {
    // First try the RPC function
    const { error } = await supabase.rpc('reset_user_tokens', {
      user_id_param: userId,
      token_amount: tokenAmount,
    });

    if (error) {
      console.error('[debugResetTokens] RPC error:', error);

      // Fall back to direct update
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          token_balance: tokenAmount,
          tokens_used: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('[debugResetTokens] Update error:', updateError);
        throw new Error(`Failed to reset tokens: ${updateError.message}`);
      }
    }

    // Force refresh the subscription
    await tryRefreshUserSubscription(userId, tokenAmount);

    return { success: true, newBalance: tokenAmount };
  } catch (functionError) {
    console.warn('[debugResetTokens] Failed:', functionError);
    throw functionError;
  }
}
