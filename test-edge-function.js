#!/usr/bin/env node

/**
 * Test script for the deduct-tokens Edge Function
 *
 * Usage:
 *   node test-edge-function.js <userId> <tokenAmount> <operation>
 *
 * Example:
 *   node test-edge-function.js abc123 10 "LANDING_PAGE_GENERATION"
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get Supabase credentials from environment or .env file
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials');
  console.error(
    'Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file'
  );
  process.exit(1);
}

// Get command line arguments
const userId = process.argv[2];
const tokenAmount = parseInt(process.argv[3], 10);
const operation = process.argv[4] || 'TEST_OPERATION';

if (!userId || isNaN(tokenAmount)) {
  console.error(
    'Usage: node test-edge-function.js <userId> <tokenAmount> <operation>'
  );
  process.exit(1);
}

async function runTest() {
  console.log(
    `Testing deduct-tokens with userId ${userId}, tokenAmount ${tokenAmount}, operation ${operation}`
  );

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // First get the current user subscription to see their token balance
    console.log('Checking current token balance...');
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (subError) {
      console.error('Error fetching user subscription:', subError);
      process.exit(1);
    }

    if (!subscription) {
      console.error(
        'User subscription not found. Creating a test subscription first.'
      );

      // Create a test subscription
      const { error: createError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_type: 'test',
          token_balance: 1000,
          tokens_used: 0,
          next_reset_date: new Date(
            new Date().setMonth(new Date().getMonth() + 1)
          ).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (createError) {
        console.error('Error creating test subscription:', createError);
        process.exit(1);
      }

      console.log('Created a test subscription with 1000 tokens');
    } else {
      console.log(
        `Current token balance: ${subscription.token_balance}, tokens used: ${
          subscription.tokens_used || 0
        }`
      );
    }

    // Call the Edge Function
    console.log('Calling deduct-tokens Edge Function...');
    const { data, error } = await supabase.functions.invoke('deduct-tokens', {
      body: {
        userId,
        tokenAmount,
        operation,
      },
    });

    if (error) {
      console.error('Edge Function Error:', error);
      process.exit(1);
    }

    console.log('Edge Function Response:', data);

    // Verify the updated balance
    console.log('Checking updated token balance...');
    const { data: updatedSub, error: updatedError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (updatedError) {
      console.error('Error fetching updated subscription:', updatedError);
      process.exit(1);
    }

    console.log(
      `Updated token balance: ${updatedSub.token_balance}, tokens used: ${
        updatedSub.tokens_used || 0
      }`
    );

    // Check if transaction was recorded
    console.log('Checking token transaction record...');
    const { data: transactions, error: txError } = await supabase
      .from('token_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (txError) {
      console.error('Error fetching transactions:', txError);
    } else if (transactions.length > 0) {
      console.log('Latest transaction:', transactions[0]);
    } else {
      console.warn('No transaction records found');
    }

    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
}

runTest();
