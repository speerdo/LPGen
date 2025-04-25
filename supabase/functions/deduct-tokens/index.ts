import { createClient } from '@supabase/supabase-js';
import { Database } from '../_shared/database.types';

interface DeductTokensRequest {
  userId: string;
  tokenAmount: number;
  operation: string;
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

    if (subscriptionError) {
      console.error('Error fetching user subscription:', subscriptionError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch user subscription' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    if (!userSubscription) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User subscription not found' }),
        headers: { 'Content-Type': 'application/json' },
      };
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
        body: JSON.stringify({ error: 'Failed to update token balance' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Record the token transaction
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
      // Continue even if transaction recording fails
    }

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
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
