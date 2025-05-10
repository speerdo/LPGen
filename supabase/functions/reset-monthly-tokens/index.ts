/**
 * reset-monthly-tokens
 * 
 * This Supabase Edge Function resets users' token balances on a monthly basis.
 * It should be scheduled to run on the 1st day of each month. The function 
 * resets token balances based on plan type (free or premium) and records
 * the transactions for audit purposes.
 * 
 * Required environment variables:
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 * 
 * To schedule with Supabase CLI:
 * 1. supabase functions deploy reset-monthly-tokens
 * 2. Schedule via Supabase dashboard to run on the 1st of each month
 */

// Import with CDN pattern for Supabase Edge Functions
import { createClient } from '@supabase/supabase-js'

/**
 * SCHEDULED FUNCTION - Monthly Token Reset
 * 
 * This function should be deployed and scheduled to run once a month
 * using the Supabase dashboard or CLI.
 * 
 * To schedule with Supabase CLI:
 * 1. supabase functions deploy reset-monthly-tokens
 * 2. Schedule via Supabase dashboard to run on the 1st of each month
 * 
 * This will run the function at midnight on the 1st of every month.
 */

const PLANS = {
  PREMIUM: {
    monthlyTokens: 1000,
  },
  FREE: {
    monthlyTokens: 100,
  },
};

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Function to record token transactions for audit purposes
async function recordTokenTransaction(userId: string, amount: number, type: string, description: string) {
  await supabase.from('token_transactions').insert({
    user_id: userId,
    amount,
    transaction_type: type,
    description
  });
}

// Handler for the reset function
export async function handler() {
  try {
    const today = new Date();
    // Only run on the 1st day of the month
    if (today.getDate() !== 1) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: false, message: 'Not first day of month' })
      };
    }

    // Get next reset date (1st of next month)
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    
    // Reset all free plan users to 100 tokens
    const { data: freeUsers, error: freeError } = await supabase
      .from('user_subscriptions')
      .update({
        token_balance: PLANS.FREE.monthlyTokens,
        tokens_used: 0,
        next_reset_date: nextMonth.toISOString(),
        updated_at: today.toISOString()
      })
      .eq('plan_type', 'free')
      .select('user_id');
      
    if (freeError) {
      console.error('Error resetting free users:', freeError);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: freeError })
      };
    }
    
    // Record token reset transactions for free users
    if (freeUsers && freeUsers.length > 0) {
      for (const user of freeUsers) {
        await recordTokenTransaction(
          user.user_id,
          PLANS.FREE.monthlyTokens,
          'renewal',
          'Monthly token reset - free plan'
        );
      }
    }
    
    // Reset all premium plan users to their monthly token amount
    const { data: premiumUsers, error: premiumError } = await supabase
      .from('user_subscriptions')
      .update({
        token_balance: PLANS.PREMIUM.monthlyTokens,
        tokens_used: 0,
        next_reset_date: nextMonth.toISOString(),
        updated_at: today.toISOString()
      })
      .eq('plan_type', 'premium')
      .select('user_id');
      
    if (premiumError) {
      console.error('Error resetting premium users:', premiumError);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: premiumError })
      };
    }
    
    // Record token reset transactions for premium users
    if (premiumUsers && premiumUsers.length > 0) {
      for (const user of premiumUsers) {
        await recordTokenTransaction(
          user.user_id,
          PLANS.PREMIUM.monthlyTokens,
          'renewal',
          'Monthly token reset - premium plan'
        );
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        freeUsersReset: freeUsers?.length || 0,
        premiumUsersReset: premiumUsers?.length || 0
      })
    };
  } catch (error) {
    console.error('Error in monthly token reset:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: String(error) })
    };
  }
} 
