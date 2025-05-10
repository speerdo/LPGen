import { createClient } from '@supabase/supabase-js';
import { Database } from '../_shared/database.types';

interface DeductTokensRequest {
  userId: string;
  tokenAmount: number;
  operation: string;
  checkOnly?: boolean; // New flag for checking function health
}

export const handler = async (event) => {
  try {
    // Create a Supabase client
    const supabaseClient = createClient<Database>(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Parse the request body
    const requestData: DeductTokensRequest =
      typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    // Check if this is just a health check call
    if (requestData.checkOnly) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'ok',
          message: 'deduct-tokens function is operational',
        }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const { userId, tokenAmount, operation } = requestData;

    if (!userId || tokenAmount === undefined) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'userId and tokenAmount are required' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Get the user's subscription
    const { data: userSubscription, error: subscriptionError } =
      await supabaseClient
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

    // If subscription not found, try to create one
    if (subscriptionError || !userSubscription) {
      if (subscriptionError) {
        console.error('Error fetching user subscription:', subscriptionError);

        // Check if the table doesn't exist
        if (subscriptionError.message?.includes('does not exist')) {
          return {
            statusCode: 500,
            body: JSON.stringify({
              error: 'Database table "user_subscriptions" does not exist',
              code: 'TABLE_NOT_EXISTS',
            }),
            headers: { 'Content-Type': 'application/json' },
          };
        }
      }

      // Try to create a subscription
      try {
        const today = new Date();
        const nextMonth = new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          1
        );

        const { data: newSubscription, error: createError } =
          await supabaseClient
            .from('user_subscriptions')
            .insert({
              user_id: userId,
              plan_type: 'free',
              token_balance: 100, // Default token amount for new users
              tokens_used: 0,
              next_reset_date: nextMonth.toISOString(),
            })
            .select()
            .single();

        if (createError || !newSubscription) {
          return {
            statusCode: 500,
            body: JSON.stringify({
              error: 'Failed to create subscription for new user',
              details: createError?.message,
            }),
            headers: { 'Content-Type': 'application/json' },
          };
        }

        // Use the newly created subscription
        if (newSubscription.token_balance < tokenAmount) {
          return {
            statusCode: 400,
            body: JSON.stringify({
              error: 'Insufficient tokens',
              tokensRemaining: newSubscription.token_balance,
              tokensRequired: tokenAmount,
            }),
            headers: { 'Content-Type': 'application/json' },
          };
        }

        // Continue with the new subscription
        const newTokenBalance = newSubscription.token_balance - tokenAmount;

        // Update the token balance
        const { error: updateError } = await supabaseClient
          .from('user_subscriptions')
          .update({
            token_balance: newTokenBalance,
            tokens_used: tokenAmount,
          })
          .eq('user_id', userId);

        if (updateError) {
          return {
            statusCode: 500,
            body: JSON.stringify({
              error: 'Failed to update token balance for new subscription',
              details: updateError.message,
            }),
            headers: { 'Content-Type': 'application/json' },
          };
        }

        // Record the transaction and return success
        await recordTransaction(supabaseClient, userId, tokenAmount, operation);

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            tokensRemaining: newTokenBalance,
            tokensDeducted: tokenAmount,
            newUser: true,
          }),
          headers: { 'Content-Type': 'application/json' },
        };
      } catch (creationError) {
        return {
          statusCode: 500,
          body: JSON.stringify({
            error: 'Failed to create or update subscription',
            details:
              creationError instanceof Error
                ? creationError.message
                : String(creationError),
          }),
          headers: { 'Content-Type': 'application/json' },
        };
      }
    }

    // Check if the user has enough tokens
    if (userSubscription.token_balance < tokenAmount) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Insufficient tokens',
          tokensRemaining: userSubscription.token_balance,
          tokensRequired: tokenAmount,
        }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Update the user's token balance
    const newTokenBalance = userSubscription.token_balance - tokenAmount;
    const { error: updateError } = await supabaseClient
      .from('user_subscriptions')
      .update({
        token_balance: newTokenBalance,
        tokens_used: (userSubscription.tokens_used || 0) + tokenAmount,
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating token balance:', updateError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to update token balance',
          details: updateError.message,
        }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Record the token transaction
    await recordTransaction(supabaseClient, userId, tokenAmount, operation);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        tokensRemaining: newTokenBalance,
        tokensDeducted: tokenAmount,
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    console.error('Unexpected error in deduct-tokens function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};

// Helper function to record a token transaction
async function recordTransaction(
  supabaseClient,
  userId,
  tokenAmount,
  operation
) {
  try {
    const { error: transactionError } = await supabaseClient
      .from('token_transactions')
      .insert({
        user_id: userId,
        amount: tokenAmount,
        transaction_type: 'deduct',
        description: operation || 'Unknown operation',
        created_at: new Date().toISOString(),
      });

    if (transactionError) {
      console.error('Error recording token transaction:', transactionError);
      // We continue even if transaction recording fails
    }
  } catch (transactionError) {
    console.error('Exception when recording transaction:', transactionError);
    // We continue even if transaction recording fails
  }
}
